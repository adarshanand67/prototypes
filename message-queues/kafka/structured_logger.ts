#!/usr/bin/env node
/**
 * Structured Logger — Kafka as a Centralized Log Sink
 *
 * Demonstrates Kafka as a centralized log aggregation platform.
 *
 * Run: npx tsx structured_logger.ts
 */

import { Kafka, Partitioners } from 'kafkajs';

const LOG_TOPIC = 'app-logs';
const BROKERS = ['localhost:9092'];

const c: Record<string, string> = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
    magenta: '\x1b[35m', gray: '\x1b[90m', red: '\x1b[31m',
    blue: '\x1b[34m', white: '\x1b[97m',
};

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

const LEVEL_STYLE: Record<LogLevel, string> = {
    DEBUG: `${c.dim}[DEBUG]${c.reset}`,
    INFO: `${c.cyan}[INFO ]${c.reset}`,
    WARN: `${c.yellow}[WARN ]${c.reset}`,
    ERROR: `${c.red}[ERROR]${c.reset}`,
    FATAL: `${c.bold}${c.red}[FATAL]${c.reset}`,
};

const SERVICE_COLORS: Record<string, string> = {
    'api-gateway': c.cyan,
    'auth-service': c.magenta,
    'order-service': c.yellow,
    'payment-service': c.green,
    'notification-service': c.blue,
};

function banner(text: string): void {
    const line = '═'.repeat(70);
    console.log(`\n${c.blue}${c.bold}${line}\n  ${text}\n${line}${c.reset}\n`);
}

function section(text: string): void {
    console.log(`\n${c.yellow}${c.bold}▶ ${text}${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(60)}${c.reset}\n`);
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

// ─── Log Entry Types ──────────────────────────────────────────────────────────
interface LogEntry {
    '@timestamp': string;
    level: LogLevel;
    service: string;
    message: string;
    traceId: string;
    spanId: string;
    host: string;
    version: string;
    env: string;
    [key: string]: unknown;
}

function makeLog(service: string, level: LogLevel, message: string, extra: Record<string, unknown> = {}): LogEntry {
    return {
        '@timestamp': new Date().toISOString(),
        level,
        service,
        message,
        traceId: `trace-${Math.random().toString(36).slice(2, 10)}`,
        spanId: `span-${Math.random().toString(36).slice(2, 8)}`,
        host: `${service}-${Math.floor(Math.random() * 3) + 1}`,
        version: '2.1.0',
        env: 'production',
        ...extra,
    };
}

function generateServiceLogs(): LogEntry[] {
    return [
        makeLog('api-gateway', 'INFO', 'Request received', { method: 'POST', path: '/api/orders', latencyMs: 12, userId: 'u001' }),
        makeLog('api-gateway', 'INFO', 'Request received', { method: 'GET', path: '/api/users/u002', latencyMs: 5 }),
        makeLog('api-gateway', 'WARN', 'Rate limit approaching', { ip: '192.168.1.55', requestsPerMin: 95, limit: 100 }),
        makeLog('api-gateway', 'ERROR', 'Upstream timeout', { upstreamService: 'payment-service', timeoutMs: 5000 }),

        makeLog('auth-service', 'INFO', 'User authenticated', { userId: 'u001', method: 'JWT' }),
        makeLog('auth-service', 'WARN', 'Failed login attempt', { userId: 'u999', attempts: 3, ip: '10.0.0.99' }),
        makeLog('auth-service', 'ERROR', 'Token validation failed', { reason: 'signature_mismatch', userId: 'u101' }),

        makeLog('order-service', 'INFO', 'Order created', { orderId: 'O1001', amount: 149.99, itemCount: 3, userId: 'u001' }),
        makeLog('order-service', 'INFO', 'Order fulfilled', { orderId: 'O1001', warehouseId: 'WH-AP-01' }),
        makeLog('order-service', 'DEBUG', 'Inventory check', { sku: 'SKU-999', available: 42, reserved: 1 }),
        makeLog('order-service', 'WARN', 'Low stock alert', { sku: 'SKU-001', remaining: 3, threshold: 10 }),

        makeLog('payment-service', 'INFO', 'Payment initiated', { orderId: 'O1001', amount: 149.99, gateway: 'stripe' }),
        makeLog('payment-service', 'INFO', 'Payment succeeded', { orderId: 'O1001', transactionId: 'ch_3MqEN62eZvKYlo2C1W5' }),
        makeLog('payment-service', 'ERROR', 'Payment gateway error', { gateway: 'stripe', code: 'card_declined', orderId: 'O1002' }),
        makeLog('payment-service', 'FATAL', 'Database connection lost', { dbHost: 'db-primary-01', attemptedReconnects: 5 }),

        makeLog('notification-service', 'INFO', 'Email sent', { to: 'user@example.com', template: 'order_confirmed' }),
        makeLog('notification-service', 'WARN', 'SMS delivery failed', { phone: '+1-555-0100', provider: 'twilio', errorCode: 20003 }),
        makeLog('notification-service', 'DEBUG', 'Push notification queued', { userId: 'u001', deviceTokens: 2 }),
    ];
}

// ─── Log Aggregator ───────────────────────────────────────────────────────────
interface AggregatorStats {
    total: number;
    byLevel: Record<LogLevel, number>;
    byService: Record<string, number>;
    errors: Array<{ service: string; message: string; ts: string }>;
    warnings: Array<{ service: string; message: string }>;
}

class LogAggregator {
    private stats: AggregatorStats;

    constructor() {
        this.stats = {
            total: 0,
            byLevel: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 },
            byService: {},
            errors: [],
            warnings: [],
        };
    }

    process(logEntry: LogEntry): void {
        this.stats.total++;
        this.stats.byLevel[logEntry.level] = (this.stats.byLevel[logEntry.level] ?? 0) + 1;
        this.stats.byService[logEntry.service] = (this.stats.byService[logEntry.service] ?? 0) + 1;

        if (logEntry.level === 'ERROR' || logEntry.level === 'FATAL') {
            this.stats.errors.push({ service: logEntry.service, message: logEntry.message, ts: logEntry['@timestamp'] });
        }
        if (logEntry.level === 'WARN') {
            this.stats.warnings.push({ service: logEntry.service, message: logEntry.message });
        }

        this.display(logEntry);
    }

    private display(logEntry: LogEntry): void {
        const sc = SERVICE_COLORS[logEntry.service] ?? c.white;
        const level = LEVEL_STYLE[logEntry.level] ?? `[${logEntry.level}]`;
        const ts = logEntry['@timestamp'].slice(11, 23);

        const base = new Set(['@timestamp', 'level', 'service', 'message', 'traceId', 'spanId', 'host', 'version', 'env']);
        const extra = Object.entries(logEntry)
            .filter(([k]) => !base.has(k))
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(' ');

        console.log(
            `  ${c.gray}${ts}${c.reset}  ${level}  ${sc}${logEntry.service.padEnd(22)}${c.reset}` +
            `${logEntry.message}${extra ? `  ${c.dim}${extra}${c.reset}` : ''}`
        );

        if (logEntry.level === 'FATAL') {
            console.log(`\n  ${c.bold}${c.red}🚨 ALERT: FATAL error detected in ${logEntry.service}!${c.reset}`);
            console.log(`  ${c.red}   → Would trigger PagerDuty/Slack alert in production${c.reset}`);
            console.log(`  ${c.red}   → TraceID: ${logEntry.traceId} (use this to find full request trace)\n${c.reset}`);
        }
    }

    printSummary(): void {
        console.log(`\n${c.bold}${c.blue}${'─'.repeat(70)}${c.reset}`);
        console.log(`${c.bold}  📊 Log Aggregation Summary${c.reset}\n`);

        console.log(`  ${c.bold}Total Logs Processed: ${c.green}${this.stats.total}${c.reset}\n`);

        console.log(`  ${c.bold}By Level:${c.reset}`);
        for (const [level, count] of Object.entries(this.stats.byLevel) as [LogLevel, number][]) {
            const bar = '█'.repeat(count);
            console.log(`  ${LEVEL_STYLE[level]}  ${bar} ${count}`);
        }

        console.log(`\n  ${c.bold}By Service:${c.reset}`);
        for (const [service, count] of Object.entries(this.stats.byService)) {
            const sc = SERVICE_COLORS[service] ?? c.white;
            console.log(`  ${sc}${service.padEnd(24)}${c.reset} ${count} logs`);
        }

        if (this.stats.errors.length > 0) {
            console.log(`\n  ${c.bold}${c.red}⚠️  Errors Detected:${c.reset}`);
            for (const err of this.stats.errors) {
                const sc = SERVICE_COLORS[err.service] ?? c.white;
                console.log(`  ${sc}[${err.service}]${c.reset}  ${c.red}${err.message}${c.reset}`);
            }
        }

        console.log(`\n${c.bold}${c.blue}${'─'.repeat(70)}${c.reset}\n`);
    }
}

async function main(): Promise<void> {
    banner('📋 Kafka as Centralized Log Sink — Structured Logger Demo');

    const kafka = new Kafka({ clientId: 'structured-logger', brokers: BROKERS, logLevel: 1 });
    const admin = kafka.admin();
    const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
    const consumer = kafka.consumer({ groupId: 'log-aggregator-' + Date.now() });

    try {
        await admin.connect();
        const existing = await admin.listTopics();

        if (!existing.includes(LOG_TOPIC)) {
            await admin.createTopics({
                topics: [{
                    topic: LOG_TOPIC,
                    numPartitions: 5,
                    replicationFactor: 1,
                    configEntries: [
                        { name: 'retention.ms', value: String(1000 * 60 * 60 * 24 * 14) },
                        { name: 'compression.type', value: 'gzip' },
                        { name: 'max.message.bytes', value: String(1024 * 1024) },
                    ],
                }],
            });
            console.log(`  ✅ "${LOG_TOPIC}" topic created (5 partitions, keyed by service)\n`);
        }
        await admin.disconnect();

        section('PHASE 1 — 5 Services Publishing Logs');

        await producer.connect();

        const logs = generateServiceLogs();

        for (const logEntry of logs) {
            await producer.send({
                topic: LOG_TOPIC,
                messages: [{
                    key: logEntry.service,
                    value: JSON.stringify(logEntry),
                    headers: {
                        'log-level': logEntry.level,
                        'service-name': logEntry.service,
                        'trace-id': logEntry.traceId,
                        'log-version': '1.0',
                    },
                }],
            });
            await sleep(30);
        }

        console.log(`  ✅ ${logs.length} log entries published from 5 services\n`);
        await producer.disconnect();

        section('PHASE 2 — Log Aggregator Consumer (Real-Time)');
        console.log(`  Timestamp     Level     Service                Message\n`);

        const aggregator = new LogAggregator();
        let received = 0;

        await consumer.connect();
        await consumer.subscribe({ topic: LOG_TOPIC, fromBeginning: true });

        await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 8000);

            consumer.run({
                autoCommit: true,
                eachMessage: async ({ message }) => {
                    let logEntry: LogEntry;
                    try { logEntry = JSON.parse(message.value?.toString() ?? '{}') as LogEntry; } catch { return; }

                    aggregator.process(logEntry);
                    received++;

                    if (received >= logs.length) {
                        clearTimeout(timeout);
                        resolve();
                    }
                },
            });
        });

        await consumer.stop();
        await consumer.disconnect();

        aggregator.printSummary();

        banner('✅ Structured Logger Demo Complete');

    } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
    }
}

main();
