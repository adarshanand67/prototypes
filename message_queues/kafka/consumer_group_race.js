#!/usr/bin/env node
/**
 * Consumer Group Race — Kafka Deep Dive
 *
 * Demonstrates consumer group parallelism visually:
 * - 3 consumers in the SAME group → each gets 1 partition
 * - Each consumer processes independently in parallel
 * - Shows rebalancing when a consumer leaves mid-stream
 *
 * Architecture:
 *   Topic: race-track (3 partitions)
 *   Producers → 60 messages (20 per partition, keyed)
 *   Consumers × 3 → partitions assigned 1:1:1
 *
 * Run: node consumer_group_race.js
 */

import { Kafka, Partitioners } from 'kafkajs';

const TOPIC = 'race-track';
const BROKERS = ['localhost:9092'];
const GROUP_ID = 'race-group';
const NUM_MSGS = 60;
const NUM_PARTS = 3;

// ─── Colors ──────────────────────────────────────────────────────────────────
const c = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
    magenta: '\x1b[35m', gray: '\x1b[90m', red: '\x1b[31m',
    blue: '\x1b[34m',
};

const CONSUMER_COLORS = [c.cyan, c.magenta, c.yellow];
const CONSUMER_EMOJIS = ['🔵', '🟣', '🟡'];

function banner(text) {
    const line = '═'.repeat(70);
    console.log(`\n${c.green}${c.bold}${line}\n  ${text}\n${line}${c.reset}\n`);
}

function section(text) {
    console.log(`\n${c.yellow}${c.bold}▶ ${text}${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(60)}${c.reset}\n`);
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// Shared progress state for all consumers
const progress = {
    consumer0: { received: 0, partition: null, processing: false },
    consumer1: { received: 0, partition: null, processing: false },
    consumer2: { received: 0, partition: null, processing: false },
};

function renderRaceProgress(label = '') {
    const width = 40;
    process.stdout.write(`\r  `);

    for (let i = 0; i < 3; i++) {
        const state = progress[`consumer${i}`];
        const ratio = Math.min(1, state.received / (NUM_MSGS / NUM_PARTS));
        const filled = Math.round(ratio * width);
        const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
        const cc = CONSUMER_COLORS[i];
        const emoji = CONSUMER_EMOJIS[i];
        const pct = Math.round(ratio * 100);
        process.stdout.write(`${cc}${emoji} C${i}[P${state.partition ?? '?'}]${c.reset} `);
        process.stdout.write(`${cc}${bar}${c.reset} ${String(pct).padStart(3)}%  `);
    }
    if (label) process.stdout.write(`  ${c.dim}${label}${c.reset}`);
}

async function main() {
    banner('🏎️  Kafka Consumer Group Race — Parallelism Demo');

    const kafka = new Kafka({ clientId: 'race-demo', brokers: BROKERS, logLevel: 1 });
    const admin = kafka.admin();

    // ─── Setup Topic ──────────────────────────────────────────────────────────
    section('PHASE 1 — Creating Race Track Topic');

    await admin.connect();

    const existing = await admin.listTopics();
    if (existing.includes(TOPIC)) {
        await admin.deleteTopics({ topics: [TOPIC] });
        await sleep(1000);
        console.log(`  Deleted old "${TOPIC}" topic for fresh run\n`);
    }

    await admin.createTopics({
        topics: [{ topic: TOPIC, numPartitions: NUM_PARTS, replicationFactor: 1 }],
    });
    console.log(`  ✅ Topic "${TOPIC}" created with ${NUM_PARTS} partitions\n`);
    await admin.disconnect();

    // ─── Produce Messages ─────────────────────────────────────────────────────
    section('PHASE 2 — Loading Race Track with Messages');
    console.log(`  Producing ${NUM_MSGS} messages (${NUM_MSGS / NUM_PARTS} per partition)…\n`);

    const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
    await producer.connect();

    // Explicitly target all 3 partitions to guarantee even distribution
    const MSGS_PER_PART = NUM_MSGS / NUM_PARTS;
    const partDistrib = { 0: 0, 1: 0, 2: 0 };

    for (let p = 0; p < NUM_PARTS; p++) {
        for (let seq = 0; seq < MSGS_PER_PART; seq++) {
            await producer.send({
                topic: TOPIC,
                messages: [{ partition: p, value: JSON.stringify({ seq, partition: p, ts: Date.now() }) }],
            });
            partDistrib[p]++;
        }
    }

    for (const [p, cnt] of Object.entries(partDistrib)) {
        const cc = CONSUMER_COLORS[parseInt(p) % 3];
        console.log(`  ${cc}Partition ${p}${c.reset} ← ${cnt} messages loaded`);
    }

    console.log(`\n  ✅ ${NUM_MSGS} messages loaded (${MSGS_PER_PART} per partition, explicit routing)\n`);
    await producer.disconnect();

    // ─── 3 Consumers ─────────────────────────────────────────────────────────
    section('PHASE 3 — 3 Consumers Racing in Parallel (same group)');
    console.log(`  Each consumer will be assigned exactly 1 partition by Kafka's group coordinator.\n`);

    const consumers = [];
    const counters = [0, 0, 0];
    const started = Date.now();
    let totalDone = 0;

    // Display race track header
    console.log(`  ${'Consumer'.padEnd(14)}${'Progress'.padEnd(46)}Count`);
    console.log(`  ${c.dim}${'─'.repeat(66)}${c.reset}`);

    // Start 3 consumer instances
    const consumerResults = await Promise.all([0, 1, 2].map(async (idx) => {
        const consumer = kafka.consumer({
            groupId: GROUP_ID,
            sessionTimeout: 30_000,
            heartbeatInterval: 3_000,
        });

        consumers.push(consumer);
        await consumer.connect();

        consumer.on('consumer.group_join', ({ payload }) => {
            const partitions = payload.memberAssignment[TOPIC] || [];
            for (const p of partitions) {
                if (progress[`consumer${idx}`].partition === null) {
                    progress[`consumer${idx}`].partition = p;
                }
            }
        });

        await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

        return new Promise((resolve) => {
            // Time-based completion: resolve after MSGS_PER_PART messages consumed
            let resolved = false;

            consumer.run({
                autoCommit: true,
                eachMessage: async ({ partition, message }) => {
                    counters[idx]++;
                    progress[`consumer${idx}`].partition = partition;
                    progress[`consumer${idx}`].received = counters[idx];
                    totalDone++;

                    // Simulate variable processing time per consumer
                    const delay = [20, 40, 10][idx]; // C0 medium, C1 slow, C2 fastest
                    await sleep(delay);

                    if (totalDone % 5 === 0) {
                        renderRaceProgress();
                    }

                    if (!resolved && counters[idx] >= MSGS_PER_PART) {
                        resolved = true;
                        resolve({ idx, count: counters[idx], partition });
                    }
                },
            });
        });
    }));

    // Wait for all consumers to finish
    await sleep(500);
    renderRaceProgress('DONE');
    console.log('\n');

    // ─── Results ──────────────────────────────────────────────────────────────
    banner('🏆 Race Results');

    const elapsed = ((Date.now() - started) / 1000).toFixed(2);
    const sorted = [...consumerResults].sort((a, b) => a.idx - b.idx);

    console.log(`  ${c.bold}Consumer  Partition  Messages  Speed             Status${c.reset}`);
    console.log(`  ${c.dim}${'─'.repeat(62)}${c.reset}`);

    for (const r of sorted) {
        const cc = CONSUMER_COLORS[r.idx];
        const emoji = CONSUMER_EMOJIS[r.idx];
        const speed = ['Medium (20ms/msg)', 'Slow (40ms/msg)', 'Fast (10ms/msg)'][r.idx];
        console.log(
            `  ${cc}${emoji} C${r.idx}         P${r.partition}          ${String(r.count).padEnd(10)}${speed.padEnd(22)}✅${c.reset}`
        );
    }

    console.log(`\n  ${c.bold}Total elapsed: ${c.green}${elapsed}s${c.reset}`);
    console.log(`  ${c.bold}Total processed: ${c.green}${totalDone} messages${c.reset}`);

    console.log(`\n${c.yellow}${c.bold}💡 What Just Happened:${c.reset}`);
    const insights = [
        `3 consumers in the SAME group → each got assigned 1 partition`,
        `Each consumer processes its partition INDEPENDENTLY and in PARALLEL`,
        `Consumers with different speeds don't block each other`,
        `Kafka's Group Coordinator managed partition assignment automatically`,
        `This is Kafka's horizontal scalability model — add more consumers = more throughput`,
        `Rule: consumers in same group ≤ partition count (extras sit idle)`,
    ];
    for (const [i, insight] of insights.entries()) {
        console.log(`  ${c.green}${i + 1}. ${insight}${c.reset}`);
    }

    // ─── Rebalancing demo ─────────────────────────────────────────────────────
    section('PHASE 4 — Rebalancing: What Happens When a Consumer Leaves?');
    console.log(`  ${c.dim}Kafka's group coordinator detects failure and reassigns partitions.\n${c.reset}`);

    console.log(`  ${c.cyan}Before:${c.reset} 3 consumers → P0:C0, P1:C1, P2:C2`);
    console.log(`  ${c.yellow}Consumer 2 crashes (SIGKILL)...${c.reset}`);
    console.log(`  ${c.green}After:${c.reset}  2 consumers → C0 gets P0+P2, C1 keeps P1\n`);

    console.log(`  Rebalancing steps:`);
    const steps = [
        `C2 heartbeat times out (sessionTimeout=${30_000}ms)`,
        `Group Coordinator marks C2 as DEAD`,
        `Coordinator triggers group rebalance`,
        `Remaining consumers rejoin and receive new partition assignments`,
        `C0 begins consuming P2 from last committed offset (no data loss!)`,
    ];
    for (const [i, step] of steps.entries()) {
        console.log(`  ${c.dim}${i + 1}.${c.reset} ${step}`);
    }

    console.log(`\n  ${c.yellow}💡 This is why Kafka is fault-tolerant:${c.reset} committed offsets survive consumer crashes.`);
    console.log(`  The replacement consumer picks up exactly where the crashed one left off.\n`);

    // Shutdown consumers
    for (const consumer of consumers) {
        await consumer.stop().catch(() => { });
        await consumer.disconnect().catch(() => { });
    }

    banner('✅ Consumer Group Race Complete');
}

main().catch(console.error);
