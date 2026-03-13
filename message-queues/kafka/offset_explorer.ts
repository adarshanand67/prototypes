#!/usr/bin/env node
/**
 * Offset Explorer — Kafka Deep Dive
 *
 * Demonstrates Kafka offset management, time travel, and consumer group lag.
 *
 * Run: npx tsx offset_explorer.ts
 */

import { Kafka } from 'kafkajs';

const TOPIC = 'demo-events';
const BROKERS = ['localhost:9092'];
const GROUP_ID_SEEK = 'offset-seek-group';

const c: Record<string, string> = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
    magenta: '\x1b[35m', gray: '\x1b[90m', red: '\x1b[31m',
    blue: '\x1b[34m', white: '\x1b[97m',
};

const PART_COLORS = [c.cyan, c.magenta, c.yellow];

function banner(text: string): void {
    const line = '═'.repeat(70);
    console.log(`\n${c.magenta}${c.bold}${line}\n  ${text}\n${line}${c.reset}\n`);
}

function section(text: string): void {
    console.log(`\n${c.yellow}${c.bold}▶ ${text}${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(60)}${c.reset}`);
}

function log(tag: string, msg: string, extra: string = ''): void {
    const tags: Record<string, string> = {
        INFO: `${c.cyan}[INFO]${c.reset}`,
        OK: `${c.green}[ OK ]${c.reset}`,
        SEEK: `${c.magenta}[SEEK]${c.reset}`,
        RECV: `${c.green}[RECV]${c.reset}`,
        OFFS: `${c.yellow}[OFFS]${c.reset}`,
        LAG: `${c.red}[LAG ]${c.reset}`,
        ERR: `${c.red}[ERR ]${c.reset}`,
    };
    const t = tags[tag] ?? tags.INFO;
    const extra_str = extra ? `  ${c.dim}${extra}${c.reset}` : '';
    console.log(`  ${t} ${msg}${extra_str}`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

interface SeekMessage {
    partition: number;
    offset: string;
    eventType: string;
}

async function main(): Promise<void> {
    banner('📍 Kafka Offset Explorer');

    const kafka = new Kafka({ clientId: 'offset-explorer', brokers: BROKERS, logLevel: 1 });
    const admin = kafka.admin();
    const consumer = kafka.consumer({ groupId: GROUP_ID_SEEK });

    try {
        await admin.connect();
        log('OK', 'Admin connected');

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

        section('SECTION 2 — Consumer Group Lag Analysis');
        console.log(`\n  ${c.dim}Lag = how many messages a consumer group hasn't processed yet.${c.reset}`);
        console.log(`  ${c.dim}Lag > 0 means the consumer is falling behind the producer.\n${c.reset}`);

        const groups = await admin.listGroups();
        const appGroups = groups.groups.filter(g => !g.groupId.startsWith('__'));

        if (appGroups.length === 0) {
            log('INFO', 'No consumer groups found yet. Run consumer.ts first for this output.');
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
                    const latest = parseInt(topicOffsets.find(o => o.partition === partition.partition)?.high ?? '0');
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

        section('SECTION 3 — Seek to Specific Offset (Time Travel)');
        console.log(`\n  ${c.dim}Kafka lets consumers seek to any offset — read old events anytime.${c.reset}`);
        console.log(`  ${c.dim}This is what makes Kafka an "event log" not just a queue.\n${c.reset}`);

        const consumerSeek = kafka.consumer({ groupId: 'seek-demo-' + Date.now() });
        await consumerSeek.connect();
        await consumerSeek.subscribe({ topic: TOPIC, fromBeginning: false });

        const seekMessages: SeekMessage[] = [];
        const MAX_SEEK_MSGS = 3;

        consumerSeek.on('consumer.group_join', async ({ payload }) => {
            log('SEEK', `Group joined — seeking all partitions to offset ${c.bold}0${c.reset} (beginning)`);
            for (const partition of (payload.memberAssignment as Record<string, number[]>)[TOPIC] ?? []) {
                consumerSeek.seek({ topic: TOPIC, partition, offset: '0' });
                const pc = PART_COLORS[partition % 3];
                log('SEEK', `  ${pc}Partition ${partition}${c.reset} → offset ${c.bold}0${c.reset}`);
            }
        });

        await new Promise<void>((resolve) => {
            const timeout = setTimeout(async () => {
                await consumerSeek.stop();
                resolve();
            }, 5000);

            consumerSeek.run({
                autoCommit: false,
                eachMessage: async ({ partition, message }) => {
                    if (seekMessages.length >= MAX_SEEK_MSGS) return;

                    let parsed: { eventType?: string };
                    try { parsed = JSON.parse(message.value!.toString()) as { eventType?: string }; } catch { return; }

                    const pc = PART_COLORS[partition % 3];
                    const eventType = parsed.eventType ?? 'unknown';
                    seekMessages.push({ partition, offset: message.offset, eventType });

                    log('RECV',
                        `${pc}P${partition}${c.reset}@offset${c.bold}${message.offset}${c.reset}  ${c.yellow}${eventType}${c.reset}`,
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
`);

        banner('✅ Offset Explorer Complete');
        console.log(`${c.bold}CLI Commands for Offset Management:${c.reset}\n`);
        const cmds = [
            `kafka-get-offsets --topic ${TOPIC} --bootstrap-server localhost:9092`,
            `kafka-consumer-groups --describe --group demo-consumer-group --bootstrap-server localhost:9092`,
        ];
        for (const cmd of cmds) {
            console.log(`  ${c.dim}$${c.reset} ${c.cyan}${cmd}${c.reset}`);
        }
        console.log('');

    } catch (err) {
        log('ERR', (err as Error).message);
        console.error(err);
        process.exit(1);
    } finally {
        await admin.disconnect().catch(() => { });
        await consumer.disconnect().catch(() => { });
    }
}

main();
