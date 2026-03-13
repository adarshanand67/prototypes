#!/usr/bin/env node
/**
 * Offset Explorer — Kafka Deep Dive
 *
 * Offsets are THE core concept of Kafka. Unlike a queue that deletes messages
 * on consumption, Kafka keeps them. The consumer tracks WHERE it is via offsets.
 *
 * Demonstrates:
 * 1. Fetch earliest & latest offsets per partition
 * 2. Seek to a specific offset (time travel)
 * 3. Seek to timestamp (find messages from a specific time)
 * 4. Manual vs auto-commit offset comparison
 * 5. Show consumer group lag (how far behind a consumer is)
 *
 * Run: node offset_explorer.js
 */

import { Kafka } from 'kafkajs';

const TOPIC = 'demo-events';
const BROKERS = ['localhost:9092'];
const GROUP_ID_SEEK = 'offset-seek-group';

// ─── Colors ──────────────────────────────────────────────────────────────────
const c = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
    magenta: '\x1b[35m', gray: '\x1b[90m', red: '\x1b[31m',
    blue: '\x1b[34m', white: '\x1b[97m',
};

const PART_COLORS = [c.cyan, c.magenta, c.yellow];

function banner(text) {
    const line = '═'.repeat(70);
    console.log(`\n${c.magenta}${c.bold}${line}\n  ${text}\n${line}${c.reset}\n`);
}

function section(text) {
    console.log(`\n${c.yellow}${c.bold}▶ ${text}${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(60)}${c.reset}`);
}

function log(tag, msg, extra = '') {
    const tags = {
        INFO: `${c.cyan}[INFO]${c.reset}`,
        OK: `${c.green}[ OK ]${c.reset}`,
        SEEK: `${c.magenta}[SEEK]${c.reset}`,
        RECV: `${c.green}[RECV]${c.reset}`,
        OFFS: `${c.yellow}[OFFS]${c.reset}`,
        LAG: `${c.red}[LAG ]${c.reset}`,
        ERR: `${c.red}[ERR ]${c.reset}`,
    };
    const t = tags[tag] || tags.INFO;
    const extra_str = extra ? `  ${c.dim}${extra}${c.reset}` : '';
    console.log(`  ${t} ${msg}${extra_str}`);
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    banner('📍 Kafka Offset Explorer');

    const kafka = new Kafka({ clientId: 'offset-explorer', brokers: BROKERS, logLevel: 1 });
    const admin = kafka.admin();
    const consumer = kafka.consumer({ groupId: GROUP_ID_SEEK });

    try {
        await admin.connect();
        log('OK', 'Admin connected');

        // ─── SECTION 1: Fetch offsets ──────────────────────────────────────────
        section('SECTION 1 — Topic Offset Snapshot');
        console.log(`\n  ${c.dim}Every partition has an EARLIEST (start) and LATEST (end) offset.${c.reset}`);
        console.log(`  ${c.dim}The difference tells you how many messages exist right now.\n${c.reset}`);

        const topicOffsets = await admin.fetchTopicOffsets(TOPIC);


        console.log(`\n  ${c.bold}Topic: ${TOPIC}${c.reset}\n`);
        console.log(`  ${'Partition'.padEnd(12)}${'Earliest'.padEnd(14)}${'Latest'.padEnd(14)}${'Message Count'.padEnd(16)}Status`);
        console.log(`  ${c.dim}${'─'.repeat(62)}${c.reset}`);

        let totalMessages = 0;
        for (const p of topicOffsets) {
            const earliest = parseInt(p.low);
            const latest = parseInt(p.high);
            const count = latest - earliest;
            totalMessages += count;
            const pc = PART_COLORS[p.partition % 3];
            const status = count === 0 ? `${c.dim}empty${c.reset}` : `${c.green}${count} msgs${c.reset}`;
            console.log(
                `  ${pc}Partition ${p.partition}${c.reset}  ` +
                `${String(earliest).padEnd(14)}` +
                `${String(latest).padEnd(14)}` +
                `${String(count).padEnd(16)}` +
                `${status}`
            );
        }

        console.log(`\n  ${c.bold}Total messages in topic: ${c.green}${totalMessages}${c.reset}`);

        console.log(`\n  ${c.yellow}💡 Key Insight:${c.reset} Kafka${c.dim} NEVER deletes messages on read.${c.reset}`);
        console.log(`  Messages persist until retention expires (default: 7 days).`);
        console.log(`  ANY consumer can read them at ANY time by setting the offset.\n`);

        // ─── SECTION 2: Consumer Group Lag ────────────────────────────────────
        section('SECTION 2 — Consumer Group Lag Analysis');
        console.log(`\n  ${c.dim}Lag = how many messages a consumer group hasn't processed yet.${c.reset}`);
        console.log(`  ${c.dim}Lag > 0 means the consumer is falling behind the producer.\n${c.reset}`);

        const groups = await admin.listGroups();
        const appGroups = groups.groups.filter(g => !g.groupId.startsWith('__'));

        if (appGroups.length === 0) {
            log('INFO', 'No consumer groups found yet. Run consumer.js first for this output.');
        } else {
            for (const group of appGroups) {
                const offsets = await admin.fetchOffsets({ groupId: group.groupId, topics: [TOPIC] });
                const topicInfo = offsets.find(t => t.topic === TOPIC);

                if (!topicInfo) continue;

                console.log(`\n  ${c.bold}Group: ${c.cyan}${group.groupId}${c.reset}`);
                console.log(`  ${'Partition'.padEnd(12)}${'Committed'.padEnd(14)}${'Latest'.padEnd(14)}${'Lag'.padEnd(10)}Health`);
                console.log(`  ${c.dim}${'─'.repeat(58)}${c.reset}`);

                let totalLag = 0;
                for (const partition of topicInfo.partitions) {
                    const committed = parseInt(partition.offset);
                    const latest = parseInt(topicOffsets.find(o => o.partition === partition.partition)?.high || 0);
                    const lag = Math.max(0, latest - committed);
                    totalLag += lag;
                    const pc = PART_COLORS[partition.partition % 3];
                    const health = lag === 0
                        ? `${c.green}✅ caught up${c.reset}`
                        : lag < 100
                            ? `${c.yellow}⚠️  ${lag} behind${c.reset}`
                            : `${c.red}🔥 ${lag} behind${c.reset}`;

                    console.log(
                        `  ${pc}Partition ${partition.partition}${c.reset}  ` +
                        `${String(committed).padEnd(14)}` +
                        `${String(latest).padEnd(14)}` +
                        `${String(lag).padEnd(10)}` +
                        `${health}`
                    );
                }
                console.log(`\n  ${c.bold}Total lag for group "${group.groupId}": ${totalLag === 0 ? c.green + '0 (all caught up!)' : c.red + totalLag}${c.reset}`);
            }
        }

        // ─── SECTION 3: Seek to specific offset (time travel) ─────────────────
        section('SECTION 3 — Seek to Specific Offset (Time Travel)');
        console.log(`\n  ${c.dim}Kafka lets consumers seek to any offset — read old events anytime.${c.reset}`);
        console.log(`  ${c.dim}This is what makes Kafka an "event log" not just a queue.\n${c.reset}`);

        const consumerSeek = kafka.consumer({ groupId: 'seek-demo-' + Date.now() });
        await consumerSeek.connect();
        await consumerSeek.subscribe({ topic: TOPIC, fromBeginning: false });

        const seekMessages = [];
        const MAX_SEEK_MSGS = 3;

        consumerSeek.on('consumer.group_join', async ({ payload }) => {
            // Seek ALL partitions to offset 0 (beginning) after joining
            log('SEEK', `Group joined — seeking all partitions to offset ${c.bold}0${c.reset} (beginning)`);
            for (const partition of payload.memberAssignment[TOPIC] || []) {
                consumerSeek.seek({ topic: TOPIC, partition, offset: '0' });
                const pc = PART_COLORS[partition % 3];
                log('SEEK', `  ${pc}Partition ${partition}${c.reset} → offset ${c.bold}0${c.reset}`);
            }
        });

        await new Promise((resolve) => {
            const timeout = setTimeout(async () => {
                await consumerSeek.stop();
                resolve();
            }, 5000);

            consumerSeek.run({
                autoCommit: false, // Manual control — don't move the committed offset
                eachMessage: async ({ partition, message }) => {
                    if (seekMessages.length >= MAX_SEEK_MSGS) return;

                    let parsed;
                    try { parsed = JSON.parse(message.value.toString()); } catch { return; }

                    const pc = PART_COLORS[partition % 3];
                    seekMessages.push({ partition, offset: message.offset, eventType: parsed.eventType });

                    log('RECV',
                        `${pc}P${partition}${c.reset}@offset${c.bold}${message.offset}${c.reset}  ${c.yellow}${parsed.eventType}${c.reset}`,
                        `(replayed — offset NOT committed)`
                    );

                    if (seekMessages.length >= MAX_SEEK_MSGS) {
                        clearTimeout(timeout);
                        await consumerSeek.stop();
                        resolve();
                    }
                },
            });
        });

        await consumerSeek.disconnect();

        console.log(`\n  ${c.yellow}💡 Key Insight:${c.reset} We read ${seekMessages.length} old messages${c.bold} without committing offsets.${c.reset}`);
        console.log(`  The consumer group's position didn't change.`);
        console.log(`  This is how "replay" and "audit" systems are built on Kafka!\n`);

        // ─── SECTION 4: Seek to timestamp ─────────────────────────────────────
        section('SECTION 4 — Fetch Offsets by Timestamp');
        console.log(`\n  ${c.dim}Kafka can find the nearest offset for any given Unix timestamp.${c.reset}`);
        console.log(`  ${c.dim}Perfect for answering: "What happened 1 hour ago?"\n${c.reset}`);

        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const offsetsByTime = await admin.fetchTopicOffsetsByTimestamp(TOPIC, oneHourAgo);

        console.log(`  Offsets at: ${new Date(oneHourAgo).toISOString()} (1 hour ago)\n`);
        console.log(`  ${'Partition'.padEnd(12)}${'Offset at Timestamp'.padEnd(24)}Note`);
        console.log(`  ${c.dim}${'─'.repeat(55)}${c.reset}`);

        for (const o of offsetsByTime) {
            const pc = PART_COLORS[o.partition % 3];
            const offsetStr = o.offset === '-1' ? `${c.dim}(before log start)${c.reset}` : `${c.green}${o.offset}${c.reset}`;
            console.log(`  ${pc}Partition ${o.partition}${c.reset}  ${offsetStr.padEnd(24)}  ← seek here to replay from 1h ago`);
        }

        console.log(`\n  ${c.yellow}💡 Key Insight:${c.reset} Time-based offset lookup enables:`);
        console.log(`    • Disaster recovery (replay from when an outage started)`);
        console.log(`    • Audit logs (what happened at a specific time?)`);
        console.log(`    • A/B testing (replay events through a new algorithm)\n`);

        // ─── SECTION 5: Manual commit explanation ──────────────────────────────
        section('SECTION 5 — Auto-Commit vs Manual Commit');

        console.log(`
  ${c.bold}${c.yellow}Auto-Commit (autoCommit: true)${c.reset}
  ┌─────────────────────────────────────────────────────┐
  │  Consumer polls → processes → offset auto-saved     │
  │  every N milliseconds (default: 5000ms)             │
  │                                                      │
  │  ✅ Simple, low code                                 │
  │  ❌ Risk: crash between poll and commit = reprocess  │
  └─────────────────────────────────────────────────────┘

  ${c.bold}${c.cyan}Manual Commit (autoCommit: false)${c.reset}
  ┌─────────────────────────────────────────────────────┐
  │  Consumer polls → processes → YOU call commitOffsets│
  │  Only after SUCCESSFUL processing                    │
  │                                                      │
  │  ✅ At-least-once delivery guarantee                 │
  │  ✅ Full control over re-processing on failure       │
  │  ❌ More code, needs idempotent consumers            │
  └─────────────────────────────────────────────────────┘

  ${c.bold}${c.magenta}Exactly-Once (Kafka Transactions)${c.reset}
  ┌─────────────────────────────────────────────────────┐
  │  Producer + Consumer participate in a transaction   │
  │  Read-process-write as single atomic operation      │
  │                                                      │
  │  ✅ Strongest guarantee                              │
  │  ❌ Higher latency, complex setup                    │
  └─────────────────────────────────────────────────────┘
`);

        // ─── Final Summary ─────────────────────────────────────────────────────
        banner('✅ Offset Explorer Complete');
        console.log(`${c.bold}CLI Commands for Offset Management:${c.reset}\n`);
        const cmds = [
            `kafka-get-offsets --topic ${TOPIC} --bootstrap-server localhost:9092`,
            `kafka-consumer-groups --describe --group demo-consumer-group --bootstrap-server localhost:9092`,
            `kafka-consumer-groups --reset-offsets --to-earliest --topic ${TOPIC} --group demo-consumer-group --execute --bootstrap-server localhost:9092`,
            `kafka-consumer-groups --reset-offsets --to-offset 5 --topic ${TOPIC}:0 --group demo-consumer-group --execute --bootstrap-server localhost:9092`,
        ];
        for (const cmd of cmds) {
            console.log(`  ${c.dim}$${c.reset} ${c.cyan}${cmd}${c.reset}`);
        }
        console.log('');

    } catch (err) {
        log('ERR', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await admin.disconnect().catch(() => { });
        await consumer.disconnect().catch(() => { });
    }
}

main();
