import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "us-east-1", endpoint: "http://localhost:4566" });
const QUEUE_URL = "http://localhost:4566/000000000000/demo-queue";

async function main() {
    const message = {
        id: Date.now(),
        type: "test.event",
        timestamp: new Date().toISOString()
    };

    try {
        const command = new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify(message)
        });
        const response = await client.send(command);
        console.log("✅ Message sent to SQS:", response.MessageId);
    } catch (err) {
        console.error("❌ Failed to send message:", err.message);
    }
}

main();
