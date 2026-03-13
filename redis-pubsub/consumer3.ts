import Redis from 'ioredis';

const sub = new Redis();
const CHANNEL = 'news';
const CONSUMER_ID = 'Consumer-3 🟣';

interface NewsMessage {
    id: number;
    text: string;
    timestamp: string;
}

sub.subscribe(CHANNEL, (err, count) => {
    if (err) {
        console.error(`❌ ${CONSUMER_ID} failed to subscribe:`, (err as Error).message);
        process.exit(1);
    }
    console.log(`✅ ${CONSUMER_ID} subscribed to "${CHANNEL}"`);
    console.log(`   Listening for messages... (${count} active subscription)`);
    console.log('──────────────────────────────────────────────');
});

sub.on('message', (channel: string, message: string) => {
    const data = JSON.parse(message) as NewsMessage;
    console.log(`[${new Date().toISOString()}] 📥 ${CONSUMER_ID} received:`);
    console.log(`   Channel : ${channel}`);
    console.log(`   ID      : #${data.id}`);
    console.log(`   Text    : ${data.text}`);
    console.log(`   Sent at : ${data.timestamp}`);
    console.log('──────────────────────────────────────────────');
});

process.on('SIGINT', () => {
    console.log(`\n⛔ ${CONSUMER_ID} unsubscribing...`);
    sub.unsubscribe(CHANNEL).then(() => sub.quit());
    process.exit(0);
});
