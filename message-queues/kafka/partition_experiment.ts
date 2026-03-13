#!/usr/bin/env node
/**
 * Partition Experiment — Kafka Deep Dive
 *
 * Demonstrates hash-based key routing, round-robin routing, and the effect
 * of changing partition count.
 *
 * Run: npx tsx partition_experiment.ts
 */

import { Kafka, Partitioners } from 'kafkajs';

const TOPIC_3P = 'experiment-3p';
const TOPIC_6P = 'experiment-6p';
const BROKERS = ['localhost:9092'];

const c: Record<string, string> = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
    magenta: '\x1b[35m', gray: '\x1b[90m', red: '\x1b[31m',
    blue: '\x1b[34m', white: '\x1b[97m', orange: '\x1b[38;5;208m',
};

const PART_COLORS = [c.cyan, c.magenta, c.yellow, c.green, c.blue, c.orange];

function banner(text: string): void {
    const line = '═'.repeat(70);
    console.log(`\n${c.cyan}${c.bold}${line}\n  ${text}\n${line}${c.reset}\n`);
}

function section(text: string): void {
    console.log(`\n${c.yellow}${c.bold}▶ ${text}${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(60)}${c.reset}`);
}

function log(tag: string, msg: string, extra: string = ''): void {
    const tags: Record<string, string> = {
        INFO: `${c.cyan}[INFO]${c.reset}`,
        OK: `${c.green}[ OK ]${c.reset}`,
        PART: `${c.magenta}[PART]${c.reset}`,
        SEND: `${c.yellow}[SEND]${c.reset}`,
        STAT: `${c.blue}[STAT]${c.reset}`,
        ERR: `${c.red}[ERR ]${c.reset}`,
    };
    const t = tags[tag] ?? tags.INFO;
    const extra_str = extra ? `  ${c.dim}${extra}${c.reset}` : '';
    console.log(`  ${t} ${msg}${extra_str}`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

function predictPartition(key: string, numPartitions: number): number {
    let hash = 0x9747b28c;
    for (let i = 0; i < key.length; i++) {
        hash ^= key.charCodeAt(i);
        hash = Math.imul(hash, 0x5bd1e995);
        hash ^= hash >>> 15;
    }
    return Math.abs(hash) % numPartitions;
}

function renderDistributionBar(dist: Record<number, number>, total: number, numPartitions: number): void {
    console.log(`\n  ${c.bold}Partition Distribution:${c.reset}`);
    for (let p = 0; p < numPartitions; p++) {
        const count = dist[p] ?? 0;
        const pct = total > 0 ? (count / total) : 0;
        const barWidth = Math.round(pct * 30);
        const bar = '█'.repeat(barWidth) + '░'.repeat(30 - barWidth);
        const pc = PART_COLORS[p % PART_COLORS.length];
        console.log(`  ${pc}P${p}${c.reset} ${bar} ${count.toString().padStart(3)} msgs (${(pct * 100).toFixed(1)}%)`);
    }
}

async function main(): Promise<void> {
    banner('🔬 Kafka Partition Experiment');

    const kafka = new Kafka({ clientId: 'partition-exp', brokers: BROKERS, logLevel: 1 });
    const admin = kafka.admin();
    const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

    try {
        await admin.connect();
        log('OK', 'Admin connected');

        const existing = await admin.listTopics();

        for (const [topic, parts] of [[TOPIC_3P, 3], [TOPIC_6P, 6]] as [string, number][]) {
            if (!existing.includes(topic)) {
                await admin.createTopics({
                    topics: [{ topic, numPartitions: parts, replicationFactor: 1 }],
                });
                log('OK', `Topic "${topic}" created`, `partitions=${parts}`);
            } else {
                log('INFO', `Topic "${topic}" already exists`);
            }
        }

        await admin.disconnect();
        await producer.connect();
        log('OK', 'Producer connected\n');

        section('EXPERIMENT 1 — Keyed Routing (Deterministic Hash)');
        console.log(`\n  ${c.dim}Same key ALWAYS maps to same partition. This ensures ordering per entity.${c.reset}\n`);

        const keys = ['user:alice', 'user:bob', 'user:priya', 'order:1001', 'order:1002',
            'session:A1B2', 'product:SKU-999', 'payment:PAY-001'];

        console.log(`  ${c.bold}Key${' '.repeat(20)}3-Partition Topic    6-Partition Topic${c.reset}`);
        console.log(`  ${c.dim}${'─'.repeat(58)}${c.reset}`);

        for (const key of keys) {
            const p3 = predictPartition(key, 3);
            const p6 = predictPartition(key, 6);
            const pc3 = PART_COLORS[p3];
            const pc6 = PART_COLORS[p6];
            console.log(
                `  ${c.white}${key.padEnd(24)}${c.reset}` +
                `${pc3}→ Partition ${p3}${c.reset}${''.padEnd(10)}` +
                `${pc6}→ Partition ${p6}${c.reset}`
            );
        }

        console.log(`\n  ${c.yellow}💡 Key Insight:${c.reset} When you increase partitions from 3→6,`);
        console.log(`  the same key may land on a DIFFERENT partition.\n`);

        section('EXPERIMENT 2 — Round-Robin Routing (No Key)');
        console.log(`\n  ${c.dim}Without a key, Kafka distributes messages across partitions evenly.${c.reset}\n`);

        const dist3p: Record<number, number> = {};
        const dist6p: Record<number, number> = {};
        const numMessages = 30;

        log('INFO', `Sending ${numMessages} keyless messages to "${TOPIC_3P}" (3 partitions)…`);

        for (let i = 0; i < numMessages; i++) {
            const result = await producer.send({
                topic: TOPIC_3P,
                messages: [{ value: JSON.stringify({ seq: i, data: `round-robin-msg-${i}` }) }],
            });
            const p = result[0].partition;
            dist3p[p] = (dist3p[p] ?? 0) + 1;
        }

        renderDistributionBar(dist3p, numMessages, 3);

        log('INFO', `\n  Sending ${numMessages} keyless messages to "${TOPIC_6P}" (6 partitions)…`);

        for (let i = 0; i < numMessages; i++) {
            const result = await producer.send({
                topic: TOPIC_6P,
                messages: [{ value: JSON.stringify({ seq: i, data: `round-robin-msg-${i}` }) }],
            });
            const p = result[0].partition;
            dist6p[p] = (dist6p[p] ?? 0) + 1;
        }

        renderDistributionBar(dist6p, numMessages, 6);

        section('EXPERIMENT 3 — Same Keys, Different Partition Counts (Routing Change)');
        console.log(`\n  ${c.dim}Shows that partition count change reshuffles where keys land.${c.reset}\n`);

        const testKeys3: Record<number, number> = {};
        const testKeys6: Record<number, number> = {};

        const realisticKeys = [
            'user:u001', 'user:u002', 'user:u003',
            'order:o101', 'order:o102', 'order:o103',
            'session:s001', 'session:s002', 'session:s003',
        ];

        for (const key of realisticKeys) {
            for (let i = 0; i < 3; i++) {
                const r3 = await producer.send({
                    topic: TOPIC_3P,
                    messages: [{ key, value: JSON.stringify({ event: 'test', key, iter: i }) }],
                });
                const r6 = await producer.send({
                    topic: TOPIC_6P,
                    messages: [{ key, value: JSON.stringify({ event: 'test', key, iter: i }) }],
                });
                testKeys3[r3[0].partition] = (testKeys3[r3[0].partition] ?? 0) + 1;
                testKeys6[r6[0].partition] = (testKeys6[r6[0].partition] ?? 0) + 1;
                await sleep(20);
            }
        }

        console.log(`\n  ${c.bold}3-Partition Topic (${realisticKeys.length * 3} messages):${c.reset}`);
        renderDistributionBar(testKeys3, realisticKeys.length * 3, 3);

        console.log(`\n  ${c.bold}6-Partition Topic (${realisticKeys.length * 3} messages):${c.reset}`);
        renderDistributionBar(testKeys6, realisticKeys.length * 3, 6);

        banner('✅ PARTITION EXPERIMENT COMPLETE');

        const insights = [
            '  1. Keys guarantee ordering PER partition — critical for event-driven architectures',
            '  2. More partitions = more parallelism but reshuffles key assignments',
            '  3. Plan partition count upfront — increasing it changes routing for existing keys',
            '  4. Round-robin (no key) gives best load distribution at cost of ordering',
            "  5. Kafka's default partitioner uses murmur2 hash for deterministic routing",
        ];

        console.log(`${c.bold}Key Takeaways:${c.reset}`);
        for (const insight of insights) {
            console.log(`${c.green}${insight}${c.reset}`);
        }

    } catch (err) {
        log('ERR', (err as Error).message);
        console.error(err);
        process.exit(1);
    } finally {
        await producer.disconnect().catch(() => { });
    }
}

main();
