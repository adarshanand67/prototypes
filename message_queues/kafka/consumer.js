#!/usr/bin/env node
/**
 * Kafka Consumer — Demo POC
 *
 * Consumes messages from the `demo-events` topic using a consumer group.
 * Demonstrates: consumer groups, offset management, partition assignment,
 * auto-commit, per-partition ordering, graceful shutdown.
 *
 * Run: node consumer.js
 */

import { Kafka } from 'kafkajs';

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_NAME = 'demo-events';
const BROKERS = ['localhost:9092'];
const CLIENT_ID = 'demo-consumer';
const GROUP_ID = 'demo-consumer-group';

// ─────────────────────────────────────────────────────────────────────────────
// Event handlers — business logic per event type
// ─────────────────────────────────────────────────────────────────────────────
const eventHandlers = {
    'user.signup': (p) => `👤 New ${p.plan?.toUpperCase() || '?'} user: ${p.email}`,
    'order.placed': (p) => `🛒 Order #${p.orderId} — ${p.items} items, $${p.total}`,
    'payment.succeeded': (p) => `💳 Payment OK — $${p.amount ?? p.total} (attempt ${p.attempt ?? 1})`,
    'payment.failed': (p) => `❌ Payment FAILED: ${p.reason}`,
    'payment.retried': (p) => `🔁 Payment retry #${p.attempt} via ${p.method}`,
    'order.shipped': (p) => `📦 Shipped #${p.orderId} — ${p.tracking}, ETA ${p.eta}`,
    'order.delivered': (p) => `✅ Delivered #${p.orderId} at ${p.deliveredAt?.slice(0, 19)}`,
    'system.ping': (p) => `🏓 Ping from ${p.host} (${p.region}) — CPU ${p.cpuPct}%`,
};

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
    console.log(`\n${c.blue}${c.bold}${line}\n  ${text}\n${line}${c.reset}\n`);
}

function ts() {
    return `${c.gray}${new Date().toISOString().replace('T', ' ').slice(0, 23)}${c.reset}`;
}

function log(tag, msg, extra = '') {
    const tags = {
        INFO: `${c.cyan}[INFO]${c.reset}`,
        RECV: `${c.green}[RECV]${c.reset}`,
        PROC: `${c.yellow}[PROC]${c.reset}`,
        CMMT: `${c.magenta}[CMMT]${c.reset}`,
        WAIT: `${c.gray}[WAIT]${c.reset}`,
        ERR: `${c.red}[ERR ]${c.reset}`,
    };
    const t = tags[tag] || tags.INFO;
    console.log(`${ts()}  ${t} ${msg}${extra ? `  ${c.dim}${extra}${c.reset}` : ''}`);
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────
const stats = {
    received: 0,
    committed: 0,
    byPartition: {},
    byType: {},
    startTime: Date.now(),
};

function updateStats(partition, eventType) {
    stats.received++;
    stats.committed++;
    stats.byPartition[partition] = (stats.byPartition[partition] || 0) + 1;
    stats.byType[eventType] = (stats.byType[eventType] || 0) + 1;
}

function printStats() {
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    const rate = stats.committed > 0 ? (stats.committed / parseFloat(elapsed)).toFixed(2) : '0.00';

    console.log(`\n${c.bold}${c.blue}────── Consumer Stats ─────────────────────────────────${c.reset}`);
    console.log(`  Total received : ${c.green}${stats.received}${c.reset}`);
    console.log(`  Offsets commit : ${c.green}${stats.committed}${c.reset}`);
    console.log(`  Elapsed        : ${elapsed}s  (${rate} msg/s)`);

    console.log(`\n  By Partition:`);
    for (const [p, count] of Object.entries(stats.byPartition).sort()) {
        const pc = PARTITION_COLORS[parseInt(p) % 3];
        console.log(`    ${pc}Partition ${p}${c.reset} → ${count} messages`);
    }

    console.log(`\n  By Event Type:`);
    for (const [type, count] of Object.entries(stats.byType).sort()) {
        console.log(`    ${type.padEnd(26)} → ${count}`);
    }
    console.log(`${c.blue}────────────────────────────────────────────────────────${c.reset}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
    banner(`🪶 Kafka Consumer  |  group: ${GROUP_ID}  |  Waiting…`);

    const kafka = new Kafka({
        clientId: CLIENT_ID,
        brokers: BROKERS,
        logLevel: 1, // ERROR only — suppress KafkaJS internal logs
    });

    const consumer = kafka.consumer({
        groupId: GROUP_ID,
        sessionTimeout: 30_000,
        heartbeatInterval: 3_000,
        maxBytesPerPartition: 1_048_576, // 1MB per partition per fetch
        maxWaitTimeInMs: 1_000,
        retry: { retries: 3 },
    });

    try {
        // 1. Connect
        log('INFO', 'Connecting to Kafka…', `group=${GROUP_ID}`);
        await consumer.connect();
        log('INFO', 'Consumer connected');

        // 2. Subscribe
        await consumer.subscribe({
            topic: TOPIC_NAME,
            fromBeginning: true,    // replay from offset 0 on first run
        });
        log('INFO', `Subscribed to topic ${c.bold}"${TOPIC_NAME}"${c.reset}`, 'fromBeginning=true');
        log('INFO', `Group ID: ${c.bold}${GROUP_ID}${c.reset}`);
        console.log('');
        log('WAIT', `Listening for messages… Press ${c.bold}Ctrl+C${c.reset} to stop\n`);

        // 3. Partition assignment notification
        consumer.on('consumer.group_join', ({ payload }) => {
            console.log('');
            log('INFO', `Partition(s) assigned:`);
            for (const assignment of payload.memberAssignment[TOPIC_NAME] || []) {
                const pc = PARTITION_COLORS[assignment % 3];
                log('INFO', `  ${pc}Partition ${assignment}${c.reset}`);
            }
            console.log('');
        });

        // 4. Run consumer loop
        await consumer.run({
            // Auto-commit offsets every 5s (default Kafka behavior)
            autoCommit: true,
            autoCommitInterval: 5000,
            autoCommitThreshold: 1,

            eachMessage: async ({ topic, partition, message, heartbeat }) => {
                const value = message.value?.toString();
                const offset = message.offset;
                const received = Date.now();

                if (!value) return;

                let parsed;
                try {
                    parsed = JSON.parse(value);
                } catch {
                    log('ERR', `Partition ${partition}@${offset} — invalid JSON, skipping`);
                    return;
                }

                const { id, eventType, payload } = parsed;
                const handler = eventHandlers[eventType];
                const pc = PARTITION_COLORS[partition % 3];
                const key = message.key?.toString() || '(no key)';

                // Log received
                console.log(`${c.gray}${'─'.repeat(64)}${c.reset}`);
                log('RECV',
                    `${pc}P${partition}${c.reset}@${c.dim}${offset}${c.reset}  ${c.bold}${eventType.padEnd(26)}${c.reset}`,
                    `key=${key}`
                );
                log('PROC', handler ? handler(payload) : `Unknown event (${eventType})`);

                // Simulate processing latency
                await sleep(40 + Math.random() * 80);
                await heartbeat(); // keep session alive during processing

                const procMs = Date.now() - received;
                updateStats(partition, eventType);

                log('CMMT',
                    `Offset ${c.bold}${offset}${c.reset} committed`,
                    `processed in ${procMs}ms  total=${stats.committed}`
                );
            },
        });

    } catch (err) {
        log('ERR', `Fatal: ${err.message}`);
        log('ERR', 'Is Kafka running? Try: brew services start kafka');
        process.exit(1);
    }

    // 5. Graceful shutdown
    const shutdown = async (sig) => {
        console.log('');
        log('INFO', `${sig} received — stopping consumer…`);
        await consumer.stop();
        await consumer.disconnect();
        printStats();
        log('INFO', 'Shutdown complete. Goodbye! 🪶');
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
