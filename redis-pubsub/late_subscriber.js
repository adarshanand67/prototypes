import Redis from "ioredis";

const sub = new Redis();
const CHANNEL = "news";
const CONSUMER_ID = "Late-Subscriber 🟠";

console.log(`🕒 ${CONSUMER_ID} starting after a delay...`);

sub.subscribe(CHANNEL, (err, count) => {
    if (err) {
        console.error(`❌ ${CONSUMER_ID} failed to subscribe:`, err.message);
        process.exit(1);
    }
    console.log(`✅ ${CONSUMER_ID} subscribed to "${CHANNEL}"`);
    console.log(`   (Messages published before this point will NOT appear)`);
    console.log("──────────────────────────────────────────────");
});

sub.on("message", (channel, message) => {
    const data = JSON.parse(message);
    console.log(`[${new Date().toISOString()}] 📥 ${CONSUMER_ID} received:`);
    console.log(`   ID      : #${data.id}`);
    console.log(`   Text    : ${data.text}`);
    console.log("──────────────────────────────────────────────");
});

process.on("SIGINT", () => {
    console.log(`\n⛔ ${CONSUMER_ID} unsubscribing...`);
    sub.unsubscribe(CHANNEL).then(() => sub.quit());
    process.exit(0);
});
