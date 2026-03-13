import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

const client = new SQSClient({ region: 'us-east-1', endpoint: 'http://localhost:4566' });
const QUEUE_URL = 'http://localhost:4566/000000000000/demo-queue';

async function main(): Promise<void> {
    console.log('📥 SQS Subscriber polling...');
    try {
        const command = new ReceiveMessageCommand({
            QueueUrl: QUEUE_URL,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
        });
        const response = await client.send(command);
        if (response.Messages) {
            for (const msg of response.Messages) {
                console.log('📥 Received message:', msg.Body);
                await client.send(new DeleteMessageCommand({
                    QueueUrl: QUEUE_URL,
                    ReceiptHandle: msg.ReceiptHandle,
                }));
            }
        }
    } catch (err) {
        console.error('❌ Failed to receive message:', (err as Error).message);
    }
}

main();
