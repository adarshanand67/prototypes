#!/usr/bin/env node
/**
 * Dead Letter Topic (DLT) — Kafka Deep Dive
 *
 * In production, some messages will ALWAYS fail to process:
 * - malformed JSON
 * - schema violations
 * - downstream service unavailable
 *
 * The pattern: retry N times → if still failing → send to Dead Letter Topic
 * This prevents one bad message from blocking the entire partition.
 *
 * Demonstrates:
 * 1. Producer sends mix of valid + intentionally bad messages
 * 2. Consumer with retry logic (exponential backoff)
 * 3. Failed messages routed to `dead-letters` topic
 * 4. DLT Consumer reads and inspects failed messages
 *
 * Run: node dead_letter_topic.js
 */

import { Kafka, Partitioners } from 'kafkajs';

const MAIN_TOPIC = 'orders-stream';
const DLT_TOPIC = 'orders-stream.dead-letters';
const BROKERS = ['localhost:9092'];
const GROUP_ID = 'orders-processor';
const MAX_RETRY = 3;

// ─── Colors ──────────────────────────────────────────────────────────────────
const c = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
    magenta: '\x1b[35m', gray: '\x1b[90m', red: '\x1b[31m',
    blue: '\x1b[34m',
};

function banner(text) {
    const line = '═'.repeat(70);
    console.log(`\n${c.red}${c.bold}${line}\n  ${text}\n${line}${c.reset}\n`);
}

function section(text) {
    console.log(`\n${c.yellow}${c.bold}▶ ${text}${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(60)}${c.reset}\n`);
}

function log(tag, msg, extra = '') {
    const tags = {
        INFO: `${c.cyan}[INFO]${c.reset}`,
        OK: `${c.green}[ OK ]${c.reset}`,
        SEND: `${c.yellow}[SEND]${c.reset}`,
        RECV: `${c.green}[RECV]${c.reset}`,
        FAIL: `${c.red}[FAIL]${c.reset}`,
        RTRY: `${c.yellow}[RTRY]${c.reset}`,
        DLT: `${c.magenta}[ DLT]${c.reset}`,
        ERR: `${c.red}[ERR ]${c.reset}`,
    };
    const t = tags[tag] || tags.INFO;
    const extra_str = extra ? `  ${c.dim}${extra}${c.reset}` : '';
    console.log(`  ${t} ${msg}${extra_str}`);
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ─── Message Processor — business logic with validation ───────────────────────
function processOrder(order) {
    if (!order.orderId) throw new Error('Missing required field: orderId');
    if (!order.amount || order.amount <= 0) throw new Error(`Invalid amount: ${order.amount}`);
    if (order.userId.startsWith('BANNED_')) throw new Error(`Banned user: ${order.userId}`);
    if (order.country === 'XX') throw new Error('Unsupported country: XX');
    return `✅ Processed order ${order.orderId} for $${order.amount} (${order.userId})`;
}

// ─── Messages: mix of valid and intentionally broken ─────────────────────────
const TEST_MESSAGES = [
    // Valid
    { orderId: 'O001', userId: 'u001', amount: 49.99, country: 'US', _note: 'valid' },
    { orderId: 'O002', userId: 'u002', amount: 129.00, country: 'IN', _note: 'valid' },
    // Missing orderId
    { userId: 'u003', amount: 25.00, country: 'GB', _note: 'missing orderId' },
    // Valid
    { orderId: 'O004', userId: 'u004', amount: 75.50, country: 'AU', _note: 'valid' },
    // Negative amount
    { orderId: 'O005', userId: 'u005', amount: -10, country: 'CA', _note: 'negative amount' },
    // Banned user
    { orderId: 'O006', userId: 'BANNED_user99', amount: 9.99, country: 'US', _note: 'banned user' },
    // Valid
    { orderId: 'O007', userId: 'u007', amount: 200.00, country: 'DE', _note: 'valid' },
    // Unsupported country
    { orderId: 'O008', userId: 'u008', amount: 55.00, country: 'XX', _note: 'unsupported country' },
    // Valid
    { orderId: 'O009', userId: 'u009', amount: 15.00, country: 'FR', _note: 'valid' },
    // Raw malformed (will be pushed as invalid JSON)
    null, // sentinel: push raw bad bytes
];

async function main() {
    banner('☠️  Dead Letter Topic (DLT) — Poison Message Handling');

    const kafka = new Kafka({ clientId: 'dlt-demo', brokers: BROKERS, logLevel: 1 });
    const admin = kafka.admin();
    const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
    const consumer = kafka.consumer({ groupId: GROUP_ID });

    const results = { success: 0, retried: 0, dltSent: 0 };

    try {
        // ─── Setup topics ──────────────────────────────────────────────────────
        await admin.connect();
        const existing = await admin.listTopics();

        for (const [topic, parts] of [[MAIN_TOPIC, 3], [DLT_TOPIC, 1]]) {
            if (!existing.includes(topic)) {
                await admin.createTopics({
                    topics: [{
                        topic,
                        numPartitions: parts,
                        replicationFactor: 1,
                        configEntries: [
                            { name: 'retention.ms', value: String(1000 * 60 * 60 * 24 * 30) }, // 30 days for DLT
                        ],
                    }],
                });
                log('OK', `Topic "${topic}" created`, `partitions=${parts}`);
            }
        }
        await admin.disconnect();

        // ─── Produce test messages ─────────────────────────────────────────────
        section('PHASE 1 — Producing Mixed Messages (Valid + Poison)');

        await producer.connect();

        for (const [i, msg] of TEST_MESSAGES.entries()) {
            let value, key, note;

            if (msg === null) {
                // Intentionally malformed JSON
                value = Buffer.from('{ "broken": json without closing brace ');
                key = `msg-${i}`;
                note = 'malformed JSON';
            } else {
                value = JSON.stringify(msg);
                key = msg.orderId || `msg-${i}`;
                note = msg._note;
            }

            await producer.send({
                topic: MAIN_TOPIC,
                messages: [{
                    key,
                    value,
                    headers: { 'producer-note': note },
                }],
            });

            const status = note === 'valid' ? `${c.green}✅ valid${c.reset}` : `${c.red}⚠️  ${note}${c.reset}`;
            log('SEND', `msg-${String(i + 1).padStart(2, '0')} ${status}`, `key=${key}`);
        }

        console.log(`\n  ✅ ${TEST_MESSAGES.length} messages queued (5 valid, 5 poison)\n`);
        await producer.disconnect();

        // ─── Consumer with retry + DLT logic ──────────────────────────────────
        section('PHASE 2 — Consumer Processing with Retry + DLT Routing');
        console.log(`  Retry strategy: up to ${MAX_RETRY} attempts with exponential backoff`);
        console.log(`  On final failure → message sent to "${DLT_TOPIC}"\n`);

        // DLT producer (separate instance)
        const dltProducer = kafka.producer();
        await dltProducer.connect();

        await consumer.connect();
        await consumer.subscribe({ topic: MAIN_TOPIC, fromBeginning: true });

        let processed = 0;

        await new Promise((resolve) => {
            const totalExpected = TEST_MESSAGES.length;
            const timeout = setTimeout(resolve, 12000);

            consumer.run({
                autoCommit: true,  // use auto-commit; DLT pattern already handles idempotency
                eachMessage: async ({ topic, partition, message }) => {
                    const rawValue = message.value?.toString() ?? '';
                    const key = message.key?.toString() ?? '(no key)';
                    processed++;

                    console.log(`${c.dim}  ${'─'.repeat(60)}${c.reset}`);
                    log('RECV', `msg-${String(processed).padStart(2, '0')}  key=${c.bold}${key}${c.reset}`);

                    let order;
                    let lastError;
                    let succeeded = false;

                    // Parse
                    try {
                        order = JSON.parse(rawValue);
                    } catch (e) {
                        lastError = new Error(`JSON parse failed: ${e.message}`);
                    }

                    // Retry loop
                    if (order) {
                        for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
                            try {
                                const result = processOrder(order);
                                log('OK', result);
                                results.success++;
                                succeeded = true;
                                break;
                            } catch (err) {
                                lastError = err;
                                if (attempt < MAX_RETRY) {
                                    const backoff = 100 * Math.pow(2, attempt - 1);
                                    log('RTRY', `Attempt ${attempt}/${MAX_RETRY} failed: ${err.message}`, `retry in ${backoff}ms`);
                                    results.retried++;
                                    await sleep(backoff);
                                }
                            }
                        }
                    }

                    // Send to DLT if all retries failed
                    if (!succeeded) {
                        log('FAIL', `${c.red}All ${MAX_RETRY} attempts failed.${c.reset} Routing to DLT…`);

                        await dltProducer.send({
                            topic: DLT_TOPIC,
                            messages: [{
                                key: message.key,
                                value: message.value, // original raw bytes
                                headers: {
                                    'original-topic': MAIN_TOPIC,
                                    'original-partition': String(partition),
                                    'original-offset': String(message.offset),
                                    'failure-reason': lastError?.message ?? 'unknown',
                                    'failed-at': new Date().toISOString(),
                                    'retry-count': String(MAX_RETRY),
                                    'consumer-group': GROUP_ID,
                                },
                            }],
                        });

                        results.dltSent++;
                        log('DLT', `${c.magenta}Sent to DLT${c.reset}  reason: ${c.red}${lastError?.message}${c.reset}`);
                    }

                    if (processed >= totalExpected) {
                        clearTimeout(timeout);
                        resolve();
                    }
                },
            });
        });

        await consumer.stop();
        await consumer.disconnect();

        // ─── Read DLT ──────────────────────────────────────────────────────────
        section('PHASE 3 — Dead Letter Topic Inspection');
        console.log(`  Reading all failed messages from "${DLT_TOPIC}"…\n`);

        const dltConsumer = kafka.consumer({ groupId: 'dlt-inspector-' + Date.now() });
        await dltConsumer.connect();
        await dltConsumer.subscribe({ topic: DLT_TOPIC, fromBeginning: true });

        const dltMessages = [];

        await new Promise((resolve) => {
            const timeout = setTimeout(resolve, 5000);

            dltConsumer.run({
                autoCommit: true,
                eachMessage: async ({ message }) => {
                    const reason = message.headers['failure-reason']?.toString() ?? 'unknown';
                    const origTopic = message.headers['original-topic']?.toString();
                    const origPart = message.headers['original-partition']?.toString();
                    const origOff = message.headers['original-offset']?.toString();
                    const failedAt = message.headers['failed-at']?.toString();
                    const retries = message.headers['retry-count']?.toString();

                    dltMessages.push({ reason, origTopic, origPart, origOff, failedAt, retries });

                    log('DLT', `${c.magenta}Failed message found:${c.reset}`);
                    console.log(`       Key:        ${message.key?.toString()}`);
                    console.log(`       Reason:     ${c.red}${reason}${c.reset}`);
                    console.log(`       Original:   ${origTopic}/P${origPart}@${origOff}`);
                    console.log(`       Failed at:  ${failedAt}`);
                    console.log(`       Retries:    ${retries}`);
                    console.log(`       Raw value:  ${c.dim}${message.value?.toString().slice(0, 80)}…${c.reset}\n`);

                    if (dltMessages.length >= results.dltSent) {
                        clearTimeout(timeout);
                        resolve();
                    }
                },
            });
        });

        await dltConsumer.stop();
        await dltConsumer.disconnect();
        await dltProducer.disconnect();

        // ─── Summary ──────────────────────────────────────────────────────────
        banner('✅ DLT Demo Complete — Results');

        console.log(`  ${c.green}✅ Successfully processed: ${results.success}${c.reset}`);
        console.log(`  ${c.yellow}🔁 Total retry attempts:   ${results.retried}${c.reset}`);
        console.log(`  ${c.red}☠️  Sent to DLT:           ${results.dltSent}${c.reset}`);

        console.log(`\n${c.bold}${c.yellow}💡 DLT Best Practices:${c.reset}`);
        const tips = [
            `Set DLT retention to 30+ days — you'll want to debug these later`,
            `Include ALL original headers + failure metadata in DLT messages`,
            `Build a separate DLT "healing" service that periodically retries DLT`,
            `Alert on DLT lag — it means your main consumer has poison pills`,
            `Never silently discard failed messages — always DLT them`,
            `Consider a separate DLT per topic: my-topic.dead-letters convention`,
        ];
        for (const [i, tip] of tips.entries()) {
            console.log(`  ${c.green}${i + 1}. ${tip}${c.reset}`);
        }
        console.log('');

    } catch (err) {
        log('ERR', err.message);
        console.error(err);
        process.exit(1);
    }
}

main();
