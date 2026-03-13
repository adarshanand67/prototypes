import amqplib from 'amqplib';

const RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';
const QUEUE_NAME = 'demo_queue';

async function main() {
    let connection, channel;

    try {
        connection = await amqplib.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        console.log(`✅ Subscriber subscribed to "${QUEUE_NAME}"`);

        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                const data = JSON.parse(msg.content.toString());
                console.log(`📥 Received: ${data.eventType} - ${data.id}`);
                channel.ack(msg);
            }
        });
    } catch (err) {
        console.error('Failed:', err.message);
    }
}

main();
