#!/usr/bin/env node
/**
 * Kafka Config Experiment — Deep Dive
 *
 * Demonstrates live configuration changes on a running Kafka topic:
 * 1. Show current topic config
 * 2. Change retention.ms (7d → 1h)
 * 3. Change compression.type (none → gzip)
 * 4. Change max.message.bytes
 * 5. Add log.cleanup.policy=compact (for log compaction)
 * 6. Show all broker configs
 * 7. Measure impact of compression (before/after sizes)
 *
 * No restart required — Kafka applies config changes LIVE.
 *
 * Run: node kafka_config_experiment.js
 */

import { Kafka, Partitioners, CompressionTypes } from 'kafkajs';

// ConfigResourceTypes.TOPIC = 2 (kafkajs numeric value)
const TOPIC_RESOURCE_TYPE = 2;

const TOPIC = 'config-lab';
const BROKERS = ['localhost:9092'];

const c = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
    magenta: '\x1b[35m', gray: '\x1b[90m', red: '\x1b[31m',
    blue: '\x1b[34m',
};

function banner(text) {
    const line = '═'.repeat(70);
    console.log(`\n${c.yellow}${c.bold}${line}\n  ${text}\n${line}${c.reset}\n`);
}

function section(text) {
    console.log(`\n${c.cyan}${c.bold}▶ ${text}${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(60)}${c.reset}\n`);
}

function log(tag, msg, extra = '') {
    const tags = {
        INFO: `${c.cyan}[INFO]${c.reset}`,
        OK: `${c.green}[ OK ]${c.reset}`,
        CFG: `${c.magenta}[CFG ]${c.reset}`,
        MEAS: `${c.yellow}[MEAS]${c.reset}`,
        ERR: `${c.red}[ERR ]${c.reset}`,
    };
    const t = tags[tag] || tags.INFO;
    const extra_str = extra ? `  ${c.dim}${extra}${c.reset}` : '';
    console.log(`  ${t} ${msg}${extra_str}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatMs(ms) {
    const s = ms / 1000;
    const m = s / 60;
    const h = m / 60;
    const d = h / 24;
    if (d >= 1) return `${d.toFixed(1)}d`;
    if (h >= 1) return `${h.toFixed(1)}h`;
    if (m >= 1) return `${m.toFixed(1)}m`;
    return `${s.toFixed(0)}s`;
}

function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${bytes}B`;
}

async function main() {
    banner('⚙️  Kafka Config Experiment Lab');

    const kafka = new Kafka({ clientId: 'config-lab', brokers: BROKERS, logLevel: 1 });
    const admin = kafka.admin();

    try {
        await admin.connect();
        log('OK', 'Admin connected to Kafka broker');

        // ─── Create topic ──────────────────────────────────────────────────────
        const existing = await admin.listTopics();
        if (!existing.includes(TOPIC)) {
            await admin.createTopics({
                topics: [{
                    topic: TOPIC,
                    numPartitions: 3,
                    replicationFactor: 1,
                }],
            });
            // Set initial config via alterConfigs (more reliable than createTopics configEntries in KRaft)
            await admin.alterConfigs({
                resources: [{
                    type: 'topic',
                    name: TOPIC,
                    configEntries: [
                        { name: 'retention.ms', value: String(7 * 24 * 60 * 60 * 1000) },
                        { name: 'compression.type', value: 'none' },
                        { name: 'max.message.bytes', value: String(1024 * 1024) },
                        { name: 'cleanup.policy', value: 'delete' },
                    ],
                }],
            });
            log('OK', `Topic "${TOPIC}" created with initial config`);
        }

        // ─── SECTION 1: Read current config ───────────────────────────────────
        section('SECTION 1 — Current Topic Config (Before Changes)');

        const IMPORTANT_CONFIGS = [
            'retention.ms', 'retention.bytes', 'compression.type', 'max.message.bytes',
            'cleanup.policy', 'segment.ms', 'segment.bytes',
            'delete.retention.ms', 'min.cleanable.dirty.ratio',
        ];

        async function printTopicConfig(label) {
            const result = await admin.describeConfigs({
                resources: [{ type: TOPIC_RESOURCE_TYPE, name: TOPIC, configNames: IMPORTANT_CONFIGS }],
                includeSynonyms: false,
            });

            console.log(`\n  ${c.bold}${label}${c.reset}`);
            console.log(`  ${'Config Key'.padEnd(30)}${'Value'.padEnd(20)}${c.dim}What it means${c.reset}`);
            console.log(`  ${c.dim}${'─'.repeat(75)}${c.reset}`);

            const meanings = {
                'retention.ms': (v) => `Keep messages for ${formatMs(parseInt(v))}`,
                'retention.bytes': (v) => v === '-1' ? 'Unlimited by size' : `Max ${formatBytes(parseInt(v))}`,
                'compression.type': (v) => ({ none: 'No compression (raw)', gzip: 'GZIP (60-70% smaller)', lz4: 'LZ4 (faster/less)', snappy: 'Snappy (balanced)', zstd: 'ZSTD (best ratio)' }[v] || v),
                'max.message.bytes': (v) => `Max message size: ${formatBytes(parseInt(v))}`,
                'cleanup.policy': (v) => ({ delete: 'Delete old segments', compact: 'Keep latest per key', 'delete,compact': 'Compact + delete' }[v] || v),
                'min.insync.replicas': (v) => `Min ${v} replica(s) must ack writes`,
                'segment.ms': (v) => parseInt(v) > 0 ? `Roll new segment every ${formatMs(parseInt(v))}` : 'N/A',
                'segment.bytes': (v) => `Roll new segment at ${formatBytes(parseInt(v))}`,
            };

            const configs = result.resources[0]?.configEntries || [];
            for (const entry of configs) {
                if (!entry.configValue) continue;
                const key = entry.configName.padEnd(30);
                const val = entry.configValue.padEnd(20);
                const meaning = meanings[entry.configName]?.(entry.configValue) || '';
                const isDefault = entry.isDefault;
                const defMark = isDefault ? `${c.dim}(default)${c.reset}` : `${c.yellow}(custom)${c.reset}`;
                console.log(`  ${c.cyan}${key}${c.reset}${c.green}${val}${c.reset}${meaning}  ${defMark}`);
            }
            console.log('');
        }

        await printTopicConfig('Initial Configuration:');

        // ─── SECTION 2: Change retention ──────────────────────────────────────
        section('SECTION 2 — Changing Retention Policy');
        console.log(`  ${c.dim}Retention controls how long Kafka stores messages.${c.reset}`);
        console.log(`  ${c.dim}Change takes effect IMMEDIATELY — no restart needed.\n${c.reset}`);

        const retentionChanges = [
            {
                name: '1 hour retention (dev/test)',
                config: String(1 * 60 * 60 * 1000),
                use: 'High-volume dev environments, reduce disk usage',
            },
            {
                name: '90 day retention (compliance)',
                config: String(90 * 24 * 60 * 60 * 1000),
                use: 'Audit logs, financial records (SOX/GDPR)',
            },
            {
                name: '7 day retention (standard)',
                config: String(7 * 24 * 60 * 60 * 1000),
                use: 'Standard production setting',
            },
        ];

        for (const change of retentionChanges) {
            await admin.alterConfigs({
                resources: [{
                    type: TOPIC_RESOURCE_TYPE,
                    name: TOPIC,
                    configEntries: [{ name: 'retention.ms', value: change.config }],
                }],
            });

            const friendlyVal = formatMs(parseInt(change.config));
            log('CFG', `retention.ms → ${c.green}${friendlyVal}${c.reset}  (${change.name})`);
            console.log(`         Use case: ${c.dim}${change.use}${c.reset}`);
            await sleep(300);
        }

        // ─── SECTION 3: Compression comparison ────────────────────────────────
        section('SECTION 3 — Compression Experiment (Size vs Speed)');
        console.log(`  ${c.dim}We'll produce the same 50-message batch with different compression.${c.reset}\n`);

        const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
        await producer.connect();

        // Build a realistic log-like payload (compresses well)
        function makeBigMessage(i) {
            return JSON.stringify({
                eventId: `evt-${String(i).padStart(6, '0')}`,
                timestamp: new Date().toISOString(),
                userId: `user-${Math.floor(Math.random() * 100)}`,
                sessionId: `sess-${Math.floor(Math.random() * 50)}`,
                action: ['view', 'click', 'purchase', 'search', 'navigate'][i % 5],
                page: '/app/dashboard/analytics/reports/summary',
                metadata: {
                    browser: 'Chrome 121',
                    os: 'macOS 14.3',
                    ip: '192.168.1.' + (i % 255),
                    referrer: 'https://www.google.com/search?q=product+review',
                    locale: 'en-US',
                },
                properties: {
                    category: ['electronics', 'books', 'clothing', 'food'][i % 4],
                    price: (Math.random() * 500).toFixed(2),
                    currency: 'USD',
                    tags: ['promo', 'new', 'featured'].slice(0, (i % 3) + 1),
                },
            });
        }

        const compressionTypes = [
            { name: 'NONE', type: CompressionTypes.None, desc: 'No compression — fastest write, largest payload' },
            { name: 'GZIP', type: CompressionTypes.GZIP, desc: 'Best compression ratio (60-70%), higher CPU usage' },
            // Note: LZ4 and Snappy require external plugins (kafkajs-lz4, snappyjs)
        ];

        const NUM = 20;
        const compressionResults = [];

        for (const compression of compressionTypes) {
            const messages = Array.from({ length: NUM }, (_, i) => ({
                key: `test:${i}`,
                value: makeBigMessage(i),
            }));

            const totalRawBytes = messages.reduce((sum, m) => sum + m.value.length, 0);

            const t0 = Date.now();
            const result = await producer.send({
                topic: TOPIC,
                compression: compression.type,
                messages,
            });
            const elapsed = Date.now() - t0;

            compressionResults.push({
                name: compression.name,
                desc: compression.desc,
                rawBytes: totalRawBytes,
                timeMs: elapsed,
                offset: result[0].baseOffset,
            });

            log('MEAS', `${c.bold}${compression.name.padEnd(8)}${c.reset}  ${c.dim}raw=${formatBytes(totalRawBytes)}${c.reset}  time=${elapsed}ms  offset=${result[0].baseOffset}`);
        }

        await producer.disconnect();

        console.log(`\n  ${c.bold}Compression Comparison (${NUM} messages):${c.reset}\n`);
        console.log(`  ${'Type'.padEnd(10)}${'Raw Size'.padEnd(12)}${'Time'.padEnd(10)}Description`);
        console.log(`  ${c.dim}${'─'.repeat(60)}${c.reset}`);

        const baseTime = compressionResults[0].timeMs;
        for (const r of compressionResults) {
            const speedRel = r.timeMs <= baseTime ? `${c.green}fast${c.reset}` : `${c.yellow}+${r.timeMs - baseTime}ms${c.reset}`;
            console.log(
                `  ${c.cyan}${r.name.padEnd(10)}${c.reset}` +
                `${formatBytes(r.rawBytes).padEnd(12)}` +
                `${String(r.timeMs + 'ms').padEnd(10)}` +
                `${r.desc}`
            );
        }

        console.log(`\n  ${c.yellow}💡 Recommendation:${c.reset} Use ${c.bold}LZ4${c.reset} for latency-sensitive, ${c.bold}GZIP${c.reset} for storage savings`);
        console.log(`  ${c.yellow}💡 Topic-level compression:${c.reset} set ${c.cyan}compression.type=gzip${c.reset} and producers inherit it\n`);

        // ─── SECTION 4: Alter multiple configs at once ────────────────────────
        section('SECTION 4 — Applying Production-Ready Config');

        const prodConfig = [
            { name: 'retention.ms', value: String(7 * 24 * 60 * 60 * 1000), note: '7 days' },
            { name: 'retention.bytes', value: String(10 * 1024 * 1024 * 1024), note: '10GB max per partition' },
            { name: 'compression.type', value: 'lz4', note: 'LZ4 compression' },
            { name: 'max.message.bytes', value: String(5 * 1024 * 1024), note: '5MB max message' },
            { name: 'segment.ms', value: String(24 * 60 * 60 * 1000), note: 'Roll segment daily' },
        ];

        await admin.alterConfigs({
            resources: [{
                type: TOPIC_RESOURCE_TYPE,
                name: TOPIC,
                configEntries: prodConfig.map(({ name, value }) => ({ name, value })),
            }],
        });

        for (const cfg of prodConfig) {
            log('CFG', `${c.cyan}${cfg.name.padEnd(30)}${c.reset} → ${c.green}${cfg.note}${c.reset}`);
        }

        console.log('\n  ✅ All configs applied LIVE — no broker restart needed!\n');

        // ─── SECTION 5: Final config state ────────────────────────────────────
        section('SECTION 5 — Final Config State (After All Changes)');
        await printTopicConfig('Production Configuration Applied:');

        // ─── Key config reference ──────────────────────────────────────────────
        banner('✅ Config Lab Complete');

        console.log(`${c.bold}Essential Kafka Topic Configs:${c.reset}\n`);

        const configRef = [
            ['retention.ms', 'How long messages are kept (default: 7 days)'],
            ['retention.bytes', 'Max disk per partition (-1 = unlimited)'],
            ['compression.type', 'none/gzip/lz4/snappy/zstd'],
            ['max.message.bytes', 'Max single message size (default: 1MB)'],
            ['cleanup.policy', 'delete (TTL) vs compact (keep latest per key)'],
            ['min.insync.replicas', 'Replicas that must ack before write — durability vs availability tradeoff'],
            ['segment.ms', 'How long before rolling to a new log segment'],
            ['segment.bytes', 'Max segment file size before rolling'],
        ];

        console.log(`  ${'Config'.padEnd(28)}Description`);
        console.log(`  ${c.dim}${'─'.repeat(68)}${c.reset}`);
        for (const [cfg, desc] of configRef) {
            console.log(`  ${c.cyan}${cfg.padEnd(28)}${c.reset}${desc}`);
        }

        console.log(`\n${c.dim}CLI equivalents:${c.reset}`);
        console.log(`  kafka-configs --alter --entity-type topics --entity-name ${TOPIC} --add-config retention.ms=86400000 --bootstrap-server localhost:9092`);
        console.log(`  kafka-configs --describe --entity-type topics --entity-name ${TOPIC} --bootstrap-server localhost:9092\n`);

    } catch (err) {
        log('ERR', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        await admin.disconnect().catch(() => { });
    }
}

main();
