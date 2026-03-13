#!/usr/bin/env node
/**
 * Kafka Producer — Demo POC
 *
 * Publishes 12 realistic events across 3 partitions on the topic `demo-events`.
 * Demonstrates: partitioning by key, idempotent producer, rich metadata.
 *
 * Run: node producer.js
 */

import { Kafka, Partitioners, CompressionTypes } from 'kafkajs';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_NAME = 'demo-events';
const BROKERS = ['localhost:9092'];
const CLIENT_ID = 'demo-producer';
const NUM_PARTITIONS = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Sample events — keyed so same entity always lands on same partition
// ─────────────────────────────────────────────────────────────────────────────
const EVENTS = [
    // Partition by userId → ordering guaranteed per user
    { key: 'user:u001', type: 'user.signup', payload: { userId: 'u001', email: 'alice@example.com', plan: 'free' } },
    { key: 'user:u002', type: 'user.signup', payload: { userId: 'u002', email: 'bob@example.com', plan: 'pro' } },
    { key: 'user:u003', type: 'user.signup', payload: { userId: 'u003', email: 'priya@example.com', plan: 'free' } },

    // Partition by orderId → ordering guaranteed per order
    { key: 'order:o101', type: 'order.placed', payload: { orderId: 'o101', userId: 'u001', total: 49.99, items: 3 } },
    { key: 'order:o101', type: 'payment.succeeded', payload: { orderId: 'o101', amount: 49.99, method: 'card' } },
    { key: 'order:o101', type: 'order.shipped', payload: { orderId: 'o101', tracking: 'TRK-9812', eta: '2026-03-03' } },
    { key: 'order:o101', type: 'order.delivered', payload: { orderId: 'o101', deliveredAt: new Date().toISOString() } },

    { key: 'order:o102', type: 'order.placed', payload: { orderId: 'o102', userId: 'u002', total: 129.00, items: 5 } },
    { key: 'order:o102', type: 'payment.failed', payload: { orderId: 'o102', reason: 'insufficient_funds' } },
    { key: 'order:o102', type: 'payment.retried', payload: { orderId: 'o102', attempt: 2, method: 'card' } },
    { key: 'order:o102', type: 'payment.succeeded', payload: { orderId: 'o102', attempt: 2, amount: 129.00 } },

    // Partition by system → infra/health events
    { key: 'system:node-1', type: 'system.ping', payload: { host: 'node-1', region: 'ap-south-1', cpuPct: 42 } },
];

// ─────────────────────────────────────────────────────────────────────────────
// Logger
// ─────────────────────────────────────────────────────────────────────────────
const c = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
    magenta: '\x1b[35m', gray: '\x1b[90m', red: '\x1b[31m',
    blue: '\x1b[34m',
};

const PARTITION_COLORS = [c.cyan, c.magenta, c.yellow];

function banner(text) {
    const line = '═'.repeat(64);
    console.log(`\n${c.magenta}${c.bold}${line}\n  ${text}\n${line}${c.reset}\n`);
}

function ts() {
    return `${c.gray}${new Date().toISOString().replace('T', ' ').slice(0, 23)}${c.reset}`;
}

function log(tag, msg, extra = '') {
    const tags = {
        INFO: `${c.cyan}[INFO]${c.reset}`,
        OK: `${c.green}[ OK ]${c.reset}`,
        SEND: `${c.yellow}[SEND]${c.reset}`,
        ERR: `${c.red}[ERR ]${c.reset}`,
        PART: `${c.blue}[PART]${c.reset}`,
    };
    const t = tags[tag] || tags.INFO;
    console.log(`${ts()}  ${t} ${msg}${extra ? `  ${c.dim}${extra}${c.reset}` : ''}`);
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
    banner(`🪶 Kafka Producer  |  topic: ${TOPIC_NAME}  |  ${EVENTS.length} events`);

    const kafka = new Kafka({
        clientId: CLIENT_ID,
        brokers: BROKERS,
        // Suppress internal KafkaJS logs
        logLevel: 1, // ERROR only
    });

    const admin = kafka.admin();
    const producer = kafka.producer({
        createPartitioner: Partitioners.DefaultPartitioner,
        idempotent: true,    // exactly-once producer-side guarantee
        maxInFlightRequests: 1,     // required for idempotent
        retry: { retries: 3 },
    });

    try {
        // 1. Connect admin to manage topics
        log('INFO', 'Connecting to Kafka…', `brokers=${BROKERS.join(',')}`);
        await admin.connect();
        log('OK', 'Admin connected');

        // 2. Create topic with 3 partitions (idempotent — safe to re-run)
        const topics = await admin.listTopics();
        if (!topics.includes(TOPIC_NAME)) {
            await admin.createTopics({
                topics: [{
                    topic: TOPIC_NAME,
                    numPartitions: NUM_PARTITIONS,
                    replicationFactor: 1,
                    configEntries: [
                        { name: 'retention.ms', value: String(1000 * 60 * 60 * 24 * 7) }, // 7 days
                        { name: 'cleanup.policy', value: 'delete' },
                    ],
                }],
            });
            log('OK', `Topic ${c.bold}"${TOPIC_NAME}"${c.reset} created`,
                `partitions=${NUM_PARTITIONS} retention=7d`);
        } else {
            log('OK', `Topic ${c.bold}"${TOPIC_NAME}"${c.reset} already exists`);
        }
        await admin.disconnect();

        // 3. Metadata about topic partitions
        log('PART', `Key → partition mapping (hash-based, consistent):`);
        const uniqueKeys = [...new Set(EVENTS.map(e => e.key))];
        for (const key of uniqueKeys) {
            // Simulate Kafka's default partition hash (murmur2)
            let hash = 0;
            for (let i = 0; i < key.length; i++) hash = (Math.imul(31, hash) + key.charCodeAt(i)) >>> 0;
            const partition = hash % NUM_PARTITIONS;
            const pc = PARTITION_COLORS[partition];
            log('PART', `  ${key.padEnd(18)} → ${pc}Partition ${partition}${c.reset}`);
        }
        console.log('');

        // 4. Connect producer
        await producer.connect();
        log('OK', 'Producer connected (idempotent mode ON)');
        log('INFO', `Publishing ${EVENTS.length} events with 250ms delay…\n`);

        // 5. Publish events
        let sent = 0;
        for (const event of EVENTS) {
            const message = {
                id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                eventType: event.type,
                payload: event.payload,
                meta: {
                    producedAt: new Date().toISOString(),
                    source: 'producer.js',
                    version: '1.0',
                },
            };

            const result = await producer.send({
                topic: TOPIC_NAME,
                compression: CompressionTypes.GZIP,
                messages: [{
                    key: event.key,
                    value: JSON.stringify(message),
                    headers: {
                        'event-type': event.type,
                        'partition-key': event.key,
                        'producer-id': CLIENT_ID,
                    },
                }],
            });

            sent++;
            const meta = result[0];
            const partition = meta.partition;
            const pc = PARTITION_COLORS[partition % 3];
            const bar = '█'.repeat(sent) + '░'.repeat(EVENTS.length - sent);
            const offset = meta.baseOffset;

            log('SEND',
                `[${String(sent).padStart(2, '0')}/${EVENTS.length}] ${c.yellow}${event.type.padEnd(24)}${c.reset}`,
                `key=${event.key.padEnd(16)} ${pc}P${partition}${c.reset}@offset=${offset}  [${bar}]`
            );

            await sleep(250);
        }

        // 6. Summary
        console.log('');
        banner(`✅ Done! ${sent} events produced across ${NUM_PARTITIONS} partitions`);
        log('INFO', `Topic details:  ${c.bold}kafka-topics --describe --topic ${TOPIC_NAME} --bootstrap-server localhost:9092${c.reset}`);
        log('INFO', `Read group lag: ${c.bold}kafka-consumer-groups --describe --group demo-consumer-group --bootstrap-server localhost:9092${c.reset}`);

    } catch (err) {
        log('ERR', `Fatal: ${err.message}`);
        log('ERR', 'Is Kafka running? Try: brew services start kafka');
        process.exit(1);
    } finally {
        await producer.disconnect().catch(() => { });
    }
}

main();
