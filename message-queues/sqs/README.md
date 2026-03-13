# Amazon SQS — Proof of Concept

> Publisher/Subscriber demo using **AWS SDK v3** (Node.js) against **LocalStack** (local AWS emulator).  
> Switch to real AWS by removing the `endpoint` and setting real credentials in `~/.aws/credentials`.

---

## Quick Start

```bash
# 1. Start LocalStack (requires Docker)
localstack start -d
localstack status services   # wait until sqs = running

# 2. Install npm deps
npm install

# 3. Create queues (Standard + FIFO)
node setup-queue.js

# 4. Publish events
node publisher.js

# 5. Consume and delete messages
node subscriber.js
```

---

## Files

| File                 | Purpose                                                          |
|----------------------|------------------------------------------------------------------|
| `setup-queue.js`     | Creates Standard + FIFO queues on LocalStack                     |
| `publisher.js`       | Sends 6 standard + 5 FIFO events with message attributes         |
| `subscriber.js`      | Long-polls both queues, processes, DeleteMessage (≈ ACK)         |
| `schema_diagram.md`  | Sequence diagrams, concept comparisons                           |
| `package.json`       | `@aws-sdk/client-sqs` dependency                                 |

---

## Switching to Real AWS

```bash
# 1. Configure credentials
aws configure
# → Access Key ID, Secret, region=us-east-1, output=json

# 2. In publisher.js / subscriber.js, remove the endpoint line:
#    endpoint: 'http://localhost:4566',   ← delete this line

# 3. Run normally — same code, real AWS
node setup-queue.js
node publisher.js
node subscriber.js
```

---

## CLI — AWS CLI + awslocal

### LocalStack (awslocal = aws + --endpoint-url automatically)
```bash
# List queues
awslocal sqs list-queues

# Get queue attributes (depth, ARN, etc.)
awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/demo-standard-queue \
  --attribute-names All

# Send test message
awslocal sqs send-message \
  --queue-url http://localhost:4566/000000000000/demo-standard-queue \
  --message-body '{"test": true}'

# Peek at messages (without deleting — for debugging)
awslocal sqs receive-message \
  --queue-url http://localhost:4566/000000000000/demo-standard-queue \
  --max-number-of-messages 5

# Purge a queue (delete all messages)
awslocal sqs purge-queue \
  --queue-url http://localhost:4566/000000000000/demo-standard-queue

# Delete a queue
awslocal sqs delete-queue \
  --queue-url http://localhost:4566/000000000000/demo-standard-queue
```

### Real AWS (same commands, no --endpoint-url)
```bash
# List queues
aws sqs list-queues --region us-east-1

# Get queue URL by name
aws sqs get-queue-url --queue-name demo-standard-queue

# Send test message
aws sqs send-message \
  --queue-url https://sqs.us-east-1.amazonaws.com/123456789/demo-standard-queue \
  --message-body '{"test": true}'
```

---

## Design Decisions

| Choice                            | Reason                                                         |
|-----------------------------------|----------------------------------------------------------------|
| **StandardQueue** for tasks       | Email, image resize, analytics — order doesn't matter         |
| **FIFO Queue** for order lifecycle| `order.created → confirmed → shipped → delivered` must be ordered|
| **MessageAttributes**             | Filter/route without parsing body; cheaper than lambda triggers|
| **Long-poll (20s)**               | Server waits for messages — reduces empty responses 10-20x     |
| **VisibilityTimeout=30s**         | > max processing time; prevents double-processing              |
| **DeleteMessage as ACK**          | Only delete after successful processing (at-least-once safety) |
| **ContentBasedDeduplication**     | FIFO: dedup by body hash — no manual dedup IDs needed          |

---

## LocalStack — Service Management

```bash
# Start/stop
localstack start -d        # daemon mode
localstack stop
localstack status          # shows running containers
localstack status services # shows which AWS services are up

# Logs
localstack logs -f

# Reset all data (clean slate)
localstack restart
```

---

## Ports Reference

| Service             | Local (LocalStack) | Real AWS                              |
|---------------------|--------------------|---------------------------------------|
| SQS                 | localhost:4566      | sqs.{region}.amazonaws.com            |
| LocalStack UI       | localhost:4566/_localstack/info | N/A                    |
| LocalStack Health   | localhost:4566/health | N/A                                |
