#!/usr/bin/env node
/**
 * Structured Logger — Kafka as a Centralized Log Sink
 *
 * This is a KILLER use case for Kafka:
 * - Multiple services produce structured JSON logs to a Kafka topic
 * - Log aggregator consumer processes and enriches them in real-time
 * - Never lose a log — replay from any point
 * - Zero coupling between services and log storage
 *
 * Demonstrates:
 * 1. Structured JSON logging standard
 * 2. Multiple "services" publishing logs to the same topic
 * 3. Log aggregator consumer with filtering, alerting, stats
 * 4. Log levels, tracing IDs, service metadata
 * 5. Benefits over traditional logging (vs stdout/files)
 *
 * Run: node structured_logger.js
 */

import { Kafka, Partitioners } from 'kafkajs';

const LOG_TOPIC = 'app-logs';
const BROKERS = ['localhost:9092'];

// ─── Colors ──────────────────────────────────────────────────────────────────
const c = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
    magenta: '\x1b[35m', gray: '\x1b[90m', red: '\x1b[31m',
    blue: '\x1b[34m', white: '\x1b[97m',
};

const LEVEL_STYLE = {
    DEBUG: `${c.dim}[DEBUG]${c.reset}`,
    INFO: `${c.cyan}[INFO ]${c.reset}`,
    WARN: `${c.yellow}[WARN ]${c.reset}`,
    ERROR: `${c.red}[ERROR]${c.reset}`,
    FATAL: `${c.bold}${c.red}[FATAL]${c.reset}`,
};

const SERVICE_COLORS = {
    'api-gateway': c.cyan,
    'auth-service': c.magenta,
    'order-service': c.yellow,
    'payment-service': c.green,
    'notification-service': c.blue,
};

function banner(text) {
    const line = '═'.repeat(70);
    console.log(`\n${c.blue}${c.bold}${line}\n  ${text}\n${line}${c.reset}\n`);
}

function section(text) {
    console.log(`\n${c.yellow}${c.bold}▶ ${text}${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(60)}${c.reset}\n`);
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ─── Log Builder ──────────────────────────────────────────────────────────────
function makeLog(service, level, message, extra = {}) {
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

// ─── Simulated service logs ───────────────────────────────────────────────────
function generateServiceLogs() {
    return [
        // API Gateway
        makeLog('api-gateway', 'INFO', 'Request received', { method: 'POST', path: '/api/orders', latencyMs: 12, userId: 'u001' }),
        makeLog('api-gateway', 'INFO', 'Request received', { method: 'GET', path: '/api/users/u002', latencyMs: 5 }),
        makeLog('api-gateway', 'WARN', 'Rate limit approaching', { ip: '192.168.1.55', requestsPerMin: 95, limit: 100 }),
        makeLog('api-gateway', 'ERROR', 'Upstream timeout', { upstreamService: 'payment-service', timeoutMs: 5000 }),

        // Auth Service
        makeLog('auth-service', 'INFO', 'User authenticated', { userId: 'u001', method: 'JWT', tokenExpiry: '2026-03-08T00:00:00Z' }),
        makeLog('auth-service', 'WARN', 'Failed login attempt', { userId: 'u999', attempts: 3, ip: '10.0.0.99' }),
        makeLog('auth-service', 'ERROR', 'Token validation failed', { reason: 'signature_mismatch', userId: 'u101' }),

        // Order Service
        makeLog('order-service', 'INFO', 'Order created', { orderId: 'O1001', amount: 149.99, itemCount: 3, userId: 'u001' }),
        makeLog('order-service', 'INFO', 'Order fulfilled', { orderId: 'O1001', warehouseId: 'WH-AP-01', picker: 'worker:W12' }),
        makeLog('order-service', 'DEBUG', 'Inventory check', { sku: 'SKU-999', available: 42, reserved: 1 }),
        makeLog('order-service', 'WARN', 'Low stock alert', { sku: 'SKU-001', remaining: 3, threshold: 10 }),

        // Payment Service
        makeLog('payment-service', 'INFO', 'Payment initiated', { orderId: 'O1001', amount: 149.99, gateway: 'stripe' }),
        makeLog('payment-service', 'INFO', 'Payment succeeded', { orderId: 'O1001', transactionId: 'ch_3MqEN62eZvKYlo2C1W5', amount: 149.99 }),
        makeLog('payment-service', 'ERROR', 'Payment gateway error', { gateway: 'stripe', code: 'card_declined', orderId: 'O1002' }),
        makeLog('payment-service', 'FATAL', 'Database connection lost', { dbHost: 'db-primary-01', attemptedReconnects: 5 }),

        // Notification Service
        makeLog('notification-service', 'INFO', 'Email sent', { to: 'user@example.com', template: 'order_confirmed', orderId: 'O1001' }),
        makeLog('notification-service', 'WARN', 'SMS delivery failed', { phone: '+1-555-0100', provider: 'twilio', errorCode: 20003 }),
        makeLog('notification-service', 'DEBUG', 'Push notification queued', { userId: 'u001', deviceTokens: 2 }),
    ];
}

// ─── Log Aggregator ───────────────────────────────────────────────────────────
class LogAggregator {
    constructor() {
        this.stats = {
            total: 0,
            byLevel: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 },
            byService: {},
            errors: [],
            warnings: [],
        };
    }

    process(log) {
        this.stats.total++;
        this.stats.byLevel[log.level] = (this.stats.byLevel[log.level] || 0) + 1;
        this.stats.byService[log.service] = (this.stats.byService[log.service] || 0) + 1;

        if (log.level === 'ERROR' || log.level === 'FATAL') {
            this.stats.errors.push({ service: log.service, message: log.message, ts: log['@timestamp'] });
        }
        if (log.level === 'WARN') {
            this.stats.warnings.push({ service: log.service, message: log.message });
        }

        this.display(log);
    }

    display(log) {
        const sc = SERVICE_COLORS[log.service] || c.white;
        const level = LEVEL_STYLE[log.level] || `[${log.level}]`;
        const ts = log['@timestamp'].slice(11, 23); // HH:MM:SS.mmm

        // Extra fields (exclude base fields)
        const base = new Set(['@timestamp', 'level', 'service', 'message', 'traceId', 'spanId', 'host', 'version', 'env']);
        const extra = Object.entries(log)
            .filter(([k]) => !base.has(k))
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(' ');

        console.log(
            `  ${c.gray}${ts}${c.reset}  ${level}  ${sc}${log.service.padEnd(22)}${c.reset}` +
            `${log.message}${extra ? `  ${c.dim}${extra}${c.reset}` : ''}`
        );

        // Real-time alerting for critical events
        if (log.level === 'FATAL') {
            console.log(`\n  ${c.bold}${c.red}🚨 ALERT: FATAL error detected in ${log.service}!${c.reset}`);
            console.log(`  ${c.red}   → Would trigger PagerDuty/Slack alert in production${c.reset}`);
            console.log(`  ${c.red}   → TraceID: ${log.traceId} (use this to find full request trace)\n${c.reset}`);
        }
    }

    printSummary() {
        console.log(`\n${c.bold}${c.blue}${'─'.repeat(70)}${c.reset}`);
        console.log(`${c.bold}  📊 Log Aggregation Summary${c.reset}\n`);

        console.log(`  ${c.bold}Total Logs Processed: ${c.green}${this.stats.total}${c.reset}\n`);

        console.log(`  ${c.bold}By Level:${c.reset}`);
        for (const [level, count] of Object.entries(this.stats.byLevel)) {
            const bar = '█'.repeat(count);
            console.log(`  ${LEVEL_STYLE[level]}  ${bar} ${count}`);
        }

        console.log(`\n  ${c.bold}By Service:${c.reset}`);
        for (const [service, count] of Object.entries(this.stats.byService)) {
            const sc = SERVICE_COLORS[service] || c.white;
            console.log(`  ${sc}${service.padEnd(24)}${c.reset} ${count} logs`);
        }

        if (this.stats.errors.length > 0) {
            console.log(`\n  ${c.bold}${c.red}⚠️  Errors Detected:${c.reset}`);
            for (const err of this.stats.errors) {
                const sc = SERVICE_COLORS[err.service] || c.white;
                console.log(`  ${sc}[${err.service}]${c.reset}  ${c.red}${err.message}${c.reset}`);
            }
        }

        console.log(`\n${c.bold}${c.blue}${'─'.repeat(70)}${c.reset}\n`);
    }
}

async function main() {
    banner('📋 Kafka as Centralized Log Sink — Structured Logger Demo');

    const kafka = new Kafka({ clientId: 'structured-logger', brokers: BROKERS, logLevel: 1 });
    const admin = kafka.admin();
    const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
    const consumer = kafka.consumer({ groupId: 'log-aggregator-' + Date.now() });

    try {
        // ─── Setup topic ──────────────────────────────────────────────────────
        await admin.connect();
        const existing = await admin.listTopics();

        if (!existing.includes(LOG_TOPIC)) {
            await admin.createTopics({
                topics: [{
                    topic: LOG_TOPIC,
                    numPartitions: 5,  // 1 per service for ordering
                    replicationFactor: 1,
                    configEntries: [
                        { name: 'retention.ms', value: String(1000 * 60 * 60 * 24 * 14) }, // 14 days
                        { name: 'compression.type', value: 'gzip' },
                        { name: 'max.message.bytes', value: String(1024 * 1024) }, // 1MB max log
                    ],
                }],
            });
            console.log(`  ✅ "${LOG_TOPIC}" topic created (5 partitions, keyed by service)\n`);
        }
        await admin.disconnect();

        // ─── Architecture Explanation ──────────────────────────────────────────
        section('WHY Kafka for Logging?');

        console.log(`
  ${c.bold}Traditional Logging Problems:${c.reset}
  ┌─────────────────────────────────────────────────────────────┐
  │  • stdout/stderr → lost on container restart                │
  │  • File logs → hard to aggregate across 100+ services       │
  │  • ELK direct write → Elasticsearch can't handle spikes     │
  │  • No replay → can't re-analyze past logs with new queries  │
  └─────────────────────────────────────────────────────────────┘

  ${c.bold}Kafka Log Architecture:${c.reset}
  ┌─────────────────────────────────────────────────────────────┐
  │                                                              │
  │   [Service A] ──┐                                           │
  │   [Service B] ──┤──→ [Kafka: app-logs topic] ──→ [ELK]     │
  │   [Service C] ──┘         (5 partitions)    ──→ [S3]       │
  │                           7 day retention   ──→ [Alerts]   │
  │                                                              │
  │  ✅ Decouple services from log storage                       │
  │  ✅ Absorb log spikes (Kafka buffers millions/sec)           │
  │  ✅ Replay logs through new analytics at any time            │
  │  ✅ Multiple consumers: ELK + S3 + Alerting simultaneously   │
  └─────────────────────────────────────────────────────────────┘

  ${c.dim}Key: partition by service name → all logs from same service in order${c.reset}
`);

        // ─── Produce logs ─────────────────────────────────────────────────────
        section('PHASE 1 — 5 Services Publishing Logs');

        await producer.connect();

        const logs = generateServiceLogs();

        for (const logEntry of logs) {
            await producer.send({
                topic: LOG_TOPIC,
                messages: [{
                    key: logEntry.service,    // Partition by service = ordered per service
                    value: JSON.stringify(logEntry),
                    headers: {
                        'log-level': logEntry.level,
                        'service-name': logEntry.service,
                        'trace-id': logEntry.traceId,
                        'log-version': '1.0',
                    },
                }],
            });
            await sleep(30); // Simulate real-time log stream
        }

        console.log(`  ✅ ${logs.length} log entries published from 5 services\n`);
        await producer.disconnect();

        // ─── Consume & aggregate ──────────────────────────────────────────────
        section('PHASE 2 — Log Aggregator Consumer (Real-Time)');
        console.log(`  Timestamp     Level     Service                Message\n`);

        const aggregator = new LogAggregator();
        let received = 0;

        await consumer.connect();
        await consumer.subscribe({ topic: LOG_TOPIC, fromBeginning: true });

        await new Promise((resolve) => {
            const timeout = setTimeout(resolve, 8000);

            consumer.run({
                autoCommit: true,
                eachMessage: async ({ message }) => {
                    let log;
                    try { log = JSON.parse(message.value?.toString() || '{}'); } catch { return; }

                    aggregator.process(log);
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

        // ─── Summary ──────────────────────────────────────────────────────────
        aggregator.printSummary();

        banner('✅ Structured Logger Demo Complete');

        console.log(`${c.bold}${c.yellow}💡 Production Kafka Logging Benefits:${c.reset}`);
        const benefits = [
            `${c.bold}Decoupling:${c.reset} Services write to Kafka; storage backends are consumers`,
            `${c.bold}Durability:${c.reset} 7-14 days retention = replay any historical log window`,
            `${c.bold}Scalability:${c.reset} Kafka absorbs log bursts better than DB writes`,
            `${c.bold}Fan-out:${c.reset} ELK + S3 + Alerting all consume same log stream`,
            `${c.bold}Ordering:${c.reset} Keyed by service = logs arrive in order per service`,
            `${c.bold}Compression:${c.reset} GZIP reduces log volume by 60-80%`,
            `${c.bold}Tracing:${c.reset} traceId/spanId enables distributed request tracing`,
        ];
        for (const benefit of benefits) {
            console.log(`  ${c.green}→ ${benefit}${c.reset}`);
        }
        console.log('');

    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

main();
