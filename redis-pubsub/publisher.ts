import Redis from 'ioredis';

const pub = new Redis();
const CHANNEL = 'news';
let counter = 1;

interface NewsMessage {
    id: number;
    text: string;
    timestamp: string;
}

console.log(`📢 Publisher started. Broadcasting to channel: "${CHANNEL}"`);
console.log('──────────────────────────────────────────────');

async function publish(): Promise<void> {
    const timestamp = new Date().toISOString();
    const message: NewsMessage = {
        id: counter,
        text: `Breaking News #${counter}`,
        timestamp,
    };

    const subscribers = await pub.publish(CHANNEL, JSON.stringify(message));
    console.log(
        `[${timestamp}] 📨 Published msg #${counter} → ${subscribers} active subscriber(s) received it`
    );
    counter++;
}

publish();
const interval = setInterval(publish, 2000);

process.on('SIGINT', () => {
    console.log('\n⛔ Publisher stopping...');
    clearInterval(interval);
    pub.quit();
    process.exit(0);
});
