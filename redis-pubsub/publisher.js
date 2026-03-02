import Redis from "ioredis";

const pub = new Redis();
const CHANNEL = "news";
let counter = 1;

console.log(`📢 Publisher started. Broadcasting to channel: "${CHANNEL}"`);
console.log("──────────────────────────────────────────────");

async function publish() {
    const timestamp = new Date().toISOString();
    const message = JSON.stringify({
        id: counter,
        text: `Breaking News #${counter}`,
        timestamp,
    });

    const subscribers = await pub.publish(CHANNEL, message);
    console.log(
        `[${timestamp}] 📨 Published msg #${counter} → ${subscribers} active subscriber(s) received it`
    );
    counter++;
}

publish();
const interval = setInterval(publish, 2000);

process.on("SIGINT", () => {
    console.log("\n⛔ Publisher stopping...");
    clearInterval(interval);
    pub.quit();
    process.exit(0);
});
