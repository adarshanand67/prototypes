import { SQSClient, CreateQueueCommand } from "@aws-sdk/client-sqs";

const client = new SQSClient({ region: "us-east-1", endpoint: "http://localhost:4566" });
const QUEUE_NAME = "demo-queue";

async function main() {
    try {
        const command = new CreateQueueCommand({ QueueName: QUEUE_NAME });
        const response = await client.send(command);
        console.log("✅ SQS Queue created:", response.QueueUrl);
    } catch (err) {
        console.error("❌ Failed to create queue:", err.message);
    }
}

main();
