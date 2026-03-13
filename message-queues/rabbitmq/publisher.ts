#!/usr/bin/env node
/**
 * RabbitMQ Publisher — Demo POC
 *
 * Simulates a real-world event producer: publishes 10 different user/order
 * events to a durable queue called `demo_queue`.
 *
 * Run: npx tsx publisher.ts
 */

import amqplib, { Connection, Channel } from 'amqplib';

const RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';
const QUEUE_NAME = 'demo_queue';

interface EventPayload {
    [key: string]: string | number | boolean;
}

interface KafkaEvent {
    type: string;
    payload: EventPayload;
}

const EVENTS: KafkaEvent[] = [
    { type: 'user.signup', payload: { userId: 'u001', email: 'alice@example.com', plan: 'free' } },
    { type: 'user.signup', payload: { userId: 'u002', email: 'bob@example.com', plan: 'pro' } },
    { type: 'order.placed', payload: { orderId: 'o101', userId: 'u001', total: 49.99, items: 3 } },
    { type: 'order.placed', payload: { orderId: 'o102', userId: 'u002', total: 129.00, items: 5 } },
    { type: 'payment.succeeded', payload: { orderId: 'o101', amount: 49.99, method: 'card' } },
    { type: 'payment.failed', payload: { orderId: 'o102', reason: 'insufficient_funds' } },
    { type: 'order.shipped', payload: { orderId: 'o101', trackingId: 'TRK-9812', eta: '2026-03-03' } },
    { type: 'user.login', payload: { userId: 'u001', ip: '203.0.113.5', device: 'iPhone' } },
    { type: 'user.logout', payload: { userId: 'u001', sessionDuration: 3420 } },
    { type: 'system.ping', payload: { source: 'healthcheck', timestamp: new Date().toISOString() } },
];

const colors: Record<string, string> = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
};

function banner(text: string): void {
    const line = '═'.repeat(60);
    console.log(`\n${colors.magenta}${colors.bold}${line}`);
    console.log(`  ${text}`);
    console.log(`${line}${colors.reset}\n`);
}

function log(level: string, msg: string, extra: string = ''): void {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 23);
    const lvls: Record<string, string> = {
        INFO: `${colors.cyan}[INFO] ${colors.reset}`,
        OK: `${colors.green}[ OK ] ${colors.reset}`,
        SEND: `${colors.yellow}[SEND] ${colors.reset}`,
        ERR: `${colors.red}[ERR ] ${colors.reset}`,
    };
    const prefix = lvls[level] ?? lvls.INFO;
    console.log(`${colors.gray}${ts}${colors.reset}  ${prefix}${msg}${extra ? `  ${colors.dim}${extra}${colors.reset}` : ''}`);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
    banner('🐇 RabbitMQ Publisher  |  demo_queue  |  10 events');

    let connection: Connection | undefined;
    let channel: Channel | undefined;

    try {
        log('INFO', `Connecting to RabbitMQ at ${colors.bold}${RABBITMQ_URL}${colors.reset}…`);
        connection = await amqplib.connect(RABBITMQ_URL);
        log('OK', 'Connection established');

        channel = await connection.createChannel();
        log('OK', 'Channel opened');

        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: {
                'x-max-length': 1000,
                'x-message-ttl': 300_000,
            },
        });
        log('OK', `Queue ${colors.bold}"${QUEUE_NAME}"${colors.reset} declared`, '(durable, TTL=5min, maxLen=1000)');

        console.log('');
        log('INFO', `Publishing ${EVENTS.length} events with 300ms delay between each…\n`);

        let sent = 0;
        for (const event of EVENTS) {
            const message = {
                id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                eventType: event.type,
                payload: event.payload,
                meta: {
                    publishedAt: new Date().toISOString(),
                    source: 'publisher.ts',
                    version: '1.0',
                },
            };

            const msgBuffer = Buffer.from(JSON.stringify(message, null, 2));

            channel.sendToQueue(QUEUE_NAME, msgBuffer, {
                persistent: true,
                contentType: 'application/json',
                headers: {
                    'x-event-type': event.type,
                    'x-retry-count': 0,
                },
            });

            sent++;
            const bar = '█'.repeat(sent) + '░'.repeat(EVENTS.length - sent);
            log('SEND',
                `[${String(sent).padStart(2, '0')}/${EVENTS.length}] ${colors.yellow}${event.type.padEnd(22)}${colors.reset}`,
                `id=${message.id}  [${bar}]`
            );

            await sleep(300);
        }

        console.log('');
        const queueInfo = await channel.checkQueue(QUEUE_NAME);
        banner(`✅ Done! ${sent} messages sent  |  Queue depth: ${queueInfo.messageCount} msg(s)`);

        log('INFO', `Management UI: ${colors.bold}http://localhost:15672${colors.reset}  (guest/guest)`);
        log('INFO', `Queue stats:   ${colors.bold}rabbitmqctl list_queues name messages consumers${colors.reset}`);

    } catch (err) {
        log('ERR', `Failed: ${(err as Error).message}`);
        process.exit(1);
    } finally {
        if (channel) await channel.close();
        if (connection) await connection.close();
    }
}

main();
