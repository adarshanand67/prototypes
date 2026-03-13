import Redis from 'ioredis';

const sub = new Redis();
const CHANNEL = 'news';
const CONSUMER_ID = 'Late-Subscriber 🟠';

interface NewsMessage {
    id: number;
    text: string;
    timestamp?: string;
}

console.log(`🕒 ${CONSUMER_ID} starting after a delay...`);

sub.subscribe(CHANNEL, (err, count) => {
    if (err) {
        console.error(`❌ ${CONSUMER_ID} failed to subscribe:`, (err as Error).message);
        process.exit(1);
    }
    console.log(`✅ ${CONSUMER_ID} subscribed to "${CHANNEL}"`);
    console.log(`   (Messages published before this point will NOT appear)`);
    console.log('──────────────────────────────────────────────');
});

sub.on('message', (channel: string, message: string) => {
    const data = JSON.parse(message) as NewsMessage;
    console.log(`[${new Date().toISOString()}] 📥 ${CONSUMER_ID} received:`);
    console.log(`   ID      : #${data.id}`);
    console.log(`   Text    : ${data.text}`);
    console.log('──────────────────────────────────────────────');
});

process.on('SIGINT', () => {
    console.log(`\n⛔ ${CONSUMER_ID} unsubscribing...`);
    sub.unsubscribe(CHANNEL).then(() => sub.quit());
    process.exit(0);
});
