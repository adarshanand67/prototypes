# Apache Kafka — Proof of Concept

> Producer/Consumer demo using **Apache Kafka 4.2.0** (KRaft mode) via `kafkajs` (Node.js).  
> Covers: topics, partitions, keyed partitioning, idempotent producer, consumer groups, offset management.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Verify Kafka is running
brew services list | grep kafka
kafka-topics --list --bootstrap-server localhost:9092

# 3. Terminal A — start consumer first (replays from beginning automatically)
node consumer.js

# 4. Terminal B — produce 12 events
node producer.js
```

---

## Files

| File                | Purpose                                                        |
|---------------------|----------------------------------------------------------------|
| `producer.js`       | Produces 12 keyed events across 3 partitions (idempotent)     |
| `consumer.js`       | Consumer group — auto-commit offsets, graceful shutdown + stats|
| `schema_diagram.md` | Architecture diagrams, log model, partition semantics          |
| `package.json`      | `kafkajs` dependency                                           |

---

## Design Decisions

| Choice                          | Reason                                                           |
|---------------------------------|------------------------------------------------------------------|
| **3 partitions**                | Parallelism: up to 3 consumers can work simultaneously           |
| **Keyed messages**              | Same key → same partition = strict ordering per entity           |
| **Idempotent producer**         | `exactly-once` at producer side — no duplicates on retry         |
| **GZIP compression**            | Smaller network payload, especially good for JSON batches        |
| **Consumer group**              | Horizontal scalability — add more `consumer.js` instances        |
| **`fromBeginning: true`**       | Consumer replays all history on first run (Kafka killer feature) |
| **Auto-commit every 5s**        | Balance: low overhead + at-most-once failure window              |

---

## CLI — Kafka Built-in Tools

> All tools live in `/opt/homebrew/opt/kafka/bin/` (auto-added to PATH by Homebrew).

### Service
```bash
brew services start kafka
brew services stop kafka
brew services restart kafka
brew services list | grep kafka
```

### Topics
```bash
# List all topics
kafka-topics --list --bootstrap-server localhost:9092

# Create topic
kafka-topics --create \
  --topic my-topic \
  --partitions 3 \
  --replication-factor 1 \
  --bootstrap-server localhost:9092

# Describe topic (partitions, leader, offsets)
kafka-topics --describe --topic demo-events --bootstrap-server localhost:9092

# Delete topic
kafka-topics --delete --topic my-topic --bootstrap-server localhost:9092
```

### Producer (CLI)
```bash
# Interactive: type messages, send with Enter
kafka-console-producer \
  --topic demo-events \
  --bootstrap-server localhost:9092

# With key (key:value format)
kafka-console-producer \
  --topic demo-events \
  --property "key.separator=:" \
  --property "parse.key=true" \
  --bootstrap-server localhost:9092
```

### Consumer (CLI)
```bash
# Consume from beginning
kafka-console-consumer \
  --topic demo-events \
  --from-beginning \
  --bootstrap-server localhost:9092

# Show keys and timestamps
kafka-console-consumer \
  --topic demo-events \
  --from-beginning \
  --property print.key=true \
  --property print.timestamp=true \
  --bootstrap-server localhost:9092

# Specific partition
kafka-console-consumer \
  --topic demo-events \
  --partition 0 \
  --from-beginning \
  --bootstrap-server localhost:9092
```

### Consumer Groups
```bash
# List groups
kafka-consumer-groups --list --bootstrap-server localhost:9092

# Describe group (shows lag per partition)
kafka-consumer-groups \
  --describe \
  --group demo-consumer-group \
  --bootstrap-server localhost:9092

# Reset offsets (replay from beginning)
kafka-consumer-groups \
  --reset-offsets \
  --to-earliest \
  --group demo-consumer-group \
  --topic demo-events \
  --execute \
  --bootstrap-server localhost:9092
```

### Offsets & Metadata
```bash
# Show earliest/latest offsets per partition
kafka-get-offsets \
  --topic demo-events \
  --bootstrap-server localhost:9092

# Show config for topic
kafka-configs \
  --describe \
  --entity-type topics \
  --entity-name demo-events \
  --bootstrap-server localhost:9092
```

---

## Ports Reference

| Service            | Port | Protocol |
|--------------------|------|----------|
| Kafka Broker       | 9092 | TCP      |
| KRaft controller   | 9093 | TCP      |

---

## Config Files

| Path | Purpose |
|---|---|
| `/opt/homebrew/etc/kafka/server.properties` | Broker config |
| `/opt/homebrew/var/log/kafka/` | Logs |
| `/opt/homebrew/var/lib/kafka-logs/` | Topic data |

---

## Kafka vs RabbitMQ (Quick Ref)

| Feature              | Kafka               | RabbitMQ              |
|----------------------|---------------------|-----------------------|
| Storage model        | Immutable log       | Queue (delete on ACK) |
| Consumer replay      | ✅ Yes (any offset)  | ❌ No                 |
| Ordering             | Per-partition       | Per-queue             |
| Throughput           | Millions/sec        | Hundreds of thousands |
| Consumer model       | Pull (poll)         | Push                  |
| Routing              | Topic + partition   | Exchange + binding    |
| Best for             | Event streaming     | Task queues           |

---

## Next Steps

- [ ] Dead Letter Topic for failed events
- [ ] Kafka Streams for real-time aggregation (count events per type)
- [ ] Schema Registry + Avro serialization
- [ ] Multiple consumer instances (see consumer group parallelism)
- [ ] **Amazon SQS** (coming next in `message_queues/sqs/`)
