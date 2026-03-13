# Apache Kafka — Fundamentals Deep Dive

> **The mental model that changes everything:**
> Kafka is not a message queue. It is a **distributed commit log** — an append-only, ordered, immutable sequence of events that any number of consumers can read, at any time, from any point.

---

## Table of Contents

1. [The Core Mental Model](#1-the-core-mental-model)
2. [Architecture](#2-architecture)
3. [Topics](#3-topics)
4. [Partitions — The Heart of Kafka](#4-partitions--the-heart-of-kafka)
5. [Offsets — Time Travel for Data](#5-offsets--time-travel-for-data)
6. [Producers](#6-producers)
7. [Consumers & Consumer Groups](#7-consumers--consumer-groups)
8. [Delivery Guarantees](#8-delivery-guarantees)
9. [Retention & Log Compaction](#9-retention--log-compaction)
10. [Configuration Cheat Sheet](#10-configuration-cheat-sheet)
11. [When to Use Kafka vs Queue](#11-when-to-use-kafka-vs-queue)
12. [Performance Numbers](#12-performance-numbers)
13. [KRaft Mode (No Zookeeper)](#13-kraft-mode-no-zookeeper)

---

## 1. The Core Mental Model

### Queue vs Stream — The Fundamental Difference

```
MESSAGE QUEUE (RabbitMQ, SQS)            KAFKA (Event Stream / Log)
─────────────────────────────            ───────────────────────────

Producer → [msg1][msg2][msg3]            Producer → [msg1][msg2][msg3][msg4]
                                                      ↑     ↑     ↑     ↑
Consumer A reads msg1 → DELETED          Consumer A reads at offset 0
Consumer B reads msg2 → DELETED          Consumer B reads at offset 2
Consumer C reads msg3 → DELETED          Consumer C reads from offset 0 (replay!)

RULE: 1 consumer = 1 message              RULE: N consumers = same messages
```

### The Commit Log Model

```
Kafka Partition = Append-only log file on disk

Offset:  0       1       2       3       4       5
         ┌───────┬───────┬───────┬───────┬───────┐
         │ evt-A │ evt-B │ evt-C │ evt-D │ evt-E │ ← new messages append here
         └───────┴───────┴───────┴───────┴───────┘
                   ↑               ↑
            Consumer X         Consumer Y
            (at offset 1)      (at offset 3)

Messages are NEVER deleted on consumption.
They expire by time (retention.ms) or size (retention.bytes).
```

---

## 2. Architecture

```
                         KAFKA CLUSTER
    ┌────────────────────────────────────────────────────────┐
    │                                                         │
    │   ┌─────────────────────────────────────────────────┐  │
    │   │                   BROKER                         │  │
    │   │                                                  │  │
    │   │  Topic: orders (3 partitions)                    │  │
    │   │  ┌──────────────┬──────────────┬──────────────┐  │  │
    │   │  │ Partition 0  │ Partition 1  │ Partition 2  │  │  │
    │   │  │ [0][1][2][3] │ [0][1][2]   │ [0][1][2][3] │  │  │
    │   │  └──────────────┴──────────────┴──────────────┘  │  │
    │   └─────────────────────────────────────────────────┘  │
    │                                                         │
    │   KRaft Controller (replaces Zookeeper in Kafka 3.3+)  │
    └────────────────────────────────────────────────────────┘

Producers ──────────────────────────────────────────── push
                             ↑↑↑
                         [Kafka Topic]
                             ↓↓↓
Consumers ──────────────────────────────────────────── pull
```

### Key Components

| Component | What it is |
|-----------|-----------|
| **Broker** | A single Kafka server. Stores and serves topic data |
| **Cluster** | Multiple brokers working together (3/5/7 for HA) |
| **Topic** | Named stream of records (like a database table) |
| **Partition** | Ordered, immutable sub-log within a topic |
| **Offset** | Sequential index of each message within a partition |
| **Producer** | Client that writes messages to topics |
| **Consumer** | Client that reads messages from topics |
| **Consumer Group** | Set of consumers that share work across partitions |
| **KRaft Controller** | Manages cluster metadata (replaced Zookeeper in 3.3+) |

---

## 3. Topics

A **Topic** is a named category/feed to which records are published.

```bash
# Create a topic
kafka-topics --create \
  --topic orders \
  --partitions 3 \
  --replication-factor 1 \        # 1 = local dev; use 3 in production
  --bootstrap-server localhost:9092

# Describe topic (see partition layout)
kafka-topics --describe --topic orders --bootstrap-server localhost:9092

# Output:
# Topic: orders  PartitionCount: 3  ReplicationFactor: 1
# Partition: 0  Leader: 1  Replicas: 1  Isr: 1
# Partition: 1  Leader: 1  Replicas: 1  Isr: 1
# Partition: 2  Leader: 1  Replicas: 1  Isr: 1
```

### Topic Naming Convention
```
# Good:
orders-v2
user-signups
payment-events
app-logs.dead-letters      # DLT convention
audit.{service}.events

# Avoid:
data                       # Too generic
orders (then orders_v2)    # Hard to evolve schemas
```

---

## 4. Partitions — The Heart of Kafka

Partitions are how Kafka achieves **parallelism** and **scalability**.

```
Topic: orders
─────────────

Partition 0: [user:alice][user:alice]   ← ALL alice's orders in order
Partition 1: [user:bob][user:charlie]   ← bob and charlie mixed, but each in order per key
Partition 2: [user:dave][user:dave]     ← ALL dave's orders in order
```

### Key → Partition Routing (murmur2 hash)

```javascript
// Same key ALWAYS → same partition (deterministic)
hash("user:alice") % 3 = Partition 0
hash("user:alice") % 3 = Partition 0  // always!
hash("user:bob")   % 3 = Partition 1

// No key → round-robin (even distribution, no ordering)
```

### Rules of Partitions

| Rule | Why it matters |
|------|---------------|
| **Ordering is guaranteed within a partition** | Use keyed messages for per-entity ordering |
| **No ordering guarantee across partitions** | Different entities can be on different partitions |
| **1 consumer per partition per group** | You can't have more consumers than partitions |
| **More partitions = more parallelism** | But: more overhead, more file handles |
| **Can't reduce partition count** | Only increase. Plan ahead! |
| **Increasing partitions breaks key routing** | Keys hash to different partitions after resize |

### How Many Partitions?

```
Rule of thumb:
  partitions = max(expected consumers, target throughput / single-partition throughput)

Examples:
  • Small service, 3 consumers → 3 partitions
  • High-throughput, 100MB/s → 100 partitions (if single partition does 10MB/s)
  • Hot topic with 10 services → 10-30 partitions

Kafka recommendation: 10 partitions per broker is a common safe baseline
```

---

## 5. Offsets — Time Travel for Data

Every message has an **offset** — its sequential, immutable position in the partition.

```
Partition 0 layout:
  
  Offset  0  1  2  3  4  5  6  7  8
          ├──┼──┼──┼──┼──┼──┼──┼──┤
          │  │  │  │  │  │  │  │  │
          └──┴──┴──┴──┴──┴──┴──┴──┘
           ↑                       ↑
      Earliest offset          Latest offset
      (low watermark)          (high watermark)

Consumer Group "analytics": committed at offset 5
Consumer Group "alerting":  committed at offset 8 (fully caught up)
Consumer Group "replay-job": manually set to offset 0 (full replay)
```

### Offset Management

```bash
# See current offsets per consumer group
kafka-consumer-groups \
  --describe \
  --group my-group \
  --bootstrap-server localhost:9092

# Output:
# GROUP      TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
# my-group   orders  0          42              45              3   ← 3 messages behind!
# my-group   orders  1          38              38              0   ← caught up
# my-group   orders  2          51              51              0   ← caught up

# Reset offsets — replay from beginning
kafka-consumer-groups \
  --reset-offsets --to-earliest \
  --group my-group --topic orders \
  --execute \
  --bootstrap-server localhost:9092

# Reset to specific offset
kafka-consumer-groups \
  --reset-offsets --to-offset 100 \
  --group my-group --topic orders:0 \
  --execute \
  --bootstrap-server localhost:9092

# Reset by timestamp (replay from 2 hours ago)
kafka-consumer-groups \
  --reset-offsets --to-datetime 2026-03-01T12:00:00.000 \
  --group my-group --topic orders \
  --execute \
  --bootstrap-server localhost:9092
```

### Lag = Distance from Latest

```
Lag = log_end_offset - committed_offset

Lag = 0    → Consumer is real-time (healthy)
Lag > 0    → Consumer is behind (expected under load spikes)
Lag growing→ Consumer can't keep up! Add more consumers or partitions
```

---

## 6. Producers

Producers choose **which partition** to send to.

```javascript
// Strategy 1: With key (deterministic partition)
producer.send({
  topic: 'orders',
  messages: [{
    key: 'user:alice',         // murmur2(key) % partitions → always same partition
    value: JSON.stringify(order),
  }]
})

// Strategy 2: Without key (round-robin distribution)
producer.send({
  topic: 'orders',
  messages: [{ value: JSON.stringify(order) }]  // no key → spread evenly
})

// Strategy 3: Explicit partition
producer.send({
  topic: 'orders',
  messages: [{
    partition: 2,              // force to partition 2
    value: JSON.stringify(order),
  }]
})
```

### Producer Config That Matters

```javascript
const producer = kafka.producer({
  // Idempotent: exactly-once at producer side (no duplicates on retry)
  idempotent: true,
  maxInFlightRequests: 1,  // required with idempotent

  // Compression (LZ4 = best speed+ratio balance)
  // Or set CompressionTypes.GZIP on each send()

  // Retry config
  retry: {
    retries: 5,               // Retry up to 5 times
    initialRetryTime: 100,    // Start with 100ms backoff
    factor: 0.2,              // Exponential backoff factor
  },

  // Acks: how many replicas must confirm before success
  // 0 = fire-and-forget (fastest, can lose data)
  // 1 = leader only (default, risk of loss if leader crashes)
  // -1/all = all in-sync replicas (safest, slowest)
})
```

---

## 7. Consumers & Consumer Groups

### Single Consumer vs Consumer Group

```
Topic: orders (3 partitions)

─── Single Consumer ────────────────────────────────────────────
  Consumer A: P0 + P1 + P2 (all partitions)
  Throughput = single process speed
  Failure = all work stops

─── Consumer Group (3 consumers) ───────────────────────────────
  Consumer A: P0
  Consumer B: P1
  Consumer C: P2
  Throughput = 3× parallelism
  Failure = group coordinator reassigns the partition (rebalancing)

─── Consumer Group (2 consumers, 3 partitions) ──────────────────
  Consumer A: P0 + P2   (one consumer got 2 partitions)
  Consumer B: P1
  → Add Consumer C → triggers rebalancing → P0:A P1:B P2:C

─── Consumer Group (4 consumers, 3 partitions) ──────────────────
  Consumer A: P0
  Consumer B: P1
  Consumer C: P2
  Consumer D: IDLE  ← can't help, no partition assigned!
  → You can never have more active consumers than partitions
```

### Consumer Group Rebalancing

```
Rebalancing is triggered when:
  • A consumer joins the group (new instance)
  • A consumer leaves (died, scaled down, heartbeat timeout)
  • Topic partition count changes
  • Group coordinator changes

Rebalancing steps:
  1. Group Coordinator sends "STOP_FETCH" to all consumers
  2. All consumers revoke their partitions
  3. Consumers rejoin the group
  4. Coordinator assigns partitions
  5. Consumers resume from committed offsets
```

> [!IMPORTANT]
> During rebalancing, **no consumer processes messages**. This is called the "stop-the-world" problem. For large groups, use `cooperative-sticky` assignor to minimize rebalancing impact.

### Commit Strategies

```javascript
// AUTO-COMMIT (simplest, risk: at-most-once on crash)
const consumer = kafka.consumer({ groupId: 'g1' })
await consumer.run({
  autoCommit: true,
  autoCommitInterval: 5000,   // commit every 5s
  eachMessage: async ({ message }) => { processMessage(message) }
})

// MANUAL COMMIT (at-least-once delivery guarantee)
await consumer.run({
  autoCommit: false,
  eachMessage: async ({ message, resolveOffset, commitOffsetsIfNecessary }) => {
    await processMessage(message)      // must succeed before committing
    resolveOffset(message.offset)      // mark this offset as processed
    await commitOffsetsIfNecessary()   // commit if threshold reached
  }
})
```

---

## 8. Delivery Guarantees

| Guarantee | Producer Side | Consumer Side | Tradeoff |
|-----------|-------------|--------------|----------|
| **At-most-once** | acks=0 | Auto-commit before processing | May lose messages, never duplicates |
| **At-least-once** | acks=all, retries | Manual commit after processing | May get duplicate messages (idempotent consumers needed) |
| **Exactly-once** | idempotent + transactions | Offset as part of transaction | Strongest, highest latency |

```javascript
// Exactly-once: producer-side idempotency
const producer = kafka.producer({ idempotent: true })
// Kafka assigns a Producer ID + sequence numbers to detect/deduplicate retries

// Exactly-once: read-process-write transaction
await producer.transaction(async (txn) => {
  const messages = await consumer.poll()
  const results = messages.map(transform)
  await txn.send({ topic: 'output', messages: results })
  await txn.sendOffsets({ consumerGroupId: GROUP_ID, topics: offsets })
  // Commit everything atomically — either all or nothing
})
```

---

## 9. Retention & Log Compaction

### Retention by Time or Size

```
Default: keep messages for 7 days (retention.ms = 604800000)
By size: retention.bytes = 10GB per partition (-1 = unlimited)

Whichever limit is hit FIRST triggers deletion.
```

### Log Compaction

```
cleanup.policy=compact

Instead of deleting by time, compact keeps the LATEST value per key:

Timeline:
t=1: key=user:001 value={name: "Alice"}
t=2: key=user:002 value={name: "Bob"}
t=3: key=user:001 value={name: "Alice Smith"}   ← update
t=4: key=user:001 value=null                    ← tombstone (delete)

After compaction:
  user:002 → {name: "Bob"}     ← latest value
  user:001 → DELETED           ← tombstone cleaned up after delete.retention.ms

Use cases:
  • User profile store (latest state per userId)
  • Session data (latest session per sessionId)
  • Database CDC (change data capture)
```

> [!TIP]
> You can combine both: `cleanup.policy=delete,compact` — this compacts within retention window and deletes old segments.

---

## 10. Configuration Cheat Sheet

### Topic Configs

```bash
# Change retention to 1 day
kafka-configs --alter --entity-type topics --entity-name orders \
  --add-config retention.ms=86400000 \
  --bootstrap-server localhost:9092

# Enable compaction
kafka-configs --alter --entity-type topics --entity-name user-profiles \
  --add-config cleanup.policy=compact \
  --bootstrap-server localhost:9092

# Change compression
kafka-configs --alter --entity-type topics --entity-name orders \
  --add-config compression.type=lz4 \
  --bootstrap-server localhost:9092
```

### Key Config Reference

| Config | Default | Recommended Prod | Notes |
|--------|---------|-----------------|-------|
| `retention.ms` | 604800000 (7d) | depends | 7d-90d typical |
| `retention.bytes` | -1 (unlimited) | 10-100GB | per partition |
| `compression.type` | none | lz4 or gzip | 60-70% size reduction |
| `max.message.bytes` | 1048576 (1MB) | 5-10MB | match producer |
| `min.insync.replicas` | 1 | 2 | need 3 brokers |
| `cleanup.policy` | delete | depends | compact for state |
| `segment.ms` | 604800000 | 86400000 | 1d segments |
| `replication.factor` | 1 | 3 | for HA |

---

## 11. When to Use Kafka vs Queue

### Use Kafka when:

```
✅ Event sourcing / audit trail needed
✅ Multiple consumers need same event stream
✅ Replay capability required (reprocess historical data)
✅ High throughput (millions of events/second)
✅ Decoupling services in microservices architecture
✅ Real-time streaming analytics
✅ Change Data Capture (CDC) from databases
✅ Log aggregation at scale
✅ Event-driven architecture with many downstream systems
```

### Use RabbitMQ/SQS when:

```
✅ Simple task queue (email sending, image processing)
✅ Complex routing rules (exchanges, bindings)
✅ Exactly-once delivery is critical and simpler to set up
✅ Messages should be deleted immediately after consumption
✅ Smaller scale (< 100K msg/s)
✅ Already on AWS and want managed queue (SQS)
```

### Decision Matrix

| Need | Kafka | RabbitMQ | SQS |
|------|-------|----------|-----|
| Replay messages | ✅ | ❌ | ❌ |
| Multiple consumers, same message | ✅ | ❌* | ❌* |
| High throughput | ✅ | ⚠️ | ⚠️ |
| Complex routing | ❌ | ✅ | ⚠️ |
| Managed cloud | ✅ (MSK) | ✅ (CloudAMQP) | ✅ |
| Ordering | Per-partition | Per-queue | Per-FIFO-queue |
| Persistent audit log | ✅ | ❌ | ❌ |

*\*Fan-out via multiple queues/subscriptions, not native*

---

## 12. Performance Numbers

```
Single-broker Kafka (commodity hardware):
  Write throughput:  ~500MB/s  (~5M msgs/s at 100 byte messages)
  Read throughput:   ~1GB/s    (sequential disk reads via OS page cache)
  Latency:          < 5ms      (end-to-end, producer → consumer)

Why so fast?
  1. Append-only writes → sequential disk I/O (much faster than random)
  2. Zero-copy reads → OS sendfile() to network (skip user space)
  3. Batching → producer batches messages before sending
  4. Compression → smaller network payloads
  5. Page cache → kernel caches hot partitions in RAM

Real-world at scale:
  LinkedIn:   7 trillion messages/day
  Netflix:    700 billion events/day
  Uber:       100+ Kafka clusters
  Airbnb:     900+ Kafka topics
```

---

## 13. KRaft Mode (No Zookeeper)

Starting Kafka 3.3+, **KRaft** (Kafka Raft) replaces Zookeeper for cluster metadata management.

### Before KRaft (Old Architecture)

```
                  ┌─────────────┐
                  │  Zookeeper  │  ← separate cluster to manage
                  │  (3 nodes)  │
                  └──────┬──────┘
                         │ metadata
                         ↓
   ┌─────────┐    ┌─────────────┐    ┌─────────────┐
   │ Broker1 │    │   Broker2   │    │   Broker3   │
   └─────────┘    └─────────────┘    └─────────────┘

Problems:
  • Zookeeper is a separate system to operate
  • 5-10 second failover delay (Zookeeper election)
  • Scale limit: ~200,000 partitions (Zookeeper bottleneck)
```

### KRaft Architecture (Current)

```
   ┌───────────────────────────────────────────────────┐
   │                   Kafka Cluster                    │
   │                                                    │
   │  ┌───────┐  ┌───────┐  ┌───────┐                 │
   │  │Broker │  │Broker │  │Broker │ ← regular nodes  │
   │  └───────┘  └───────┘  └───────┘                 │
   │                                                    │
   │  ┌───────────────────────────────────────────┐    │
   │  │     KRaft Controller Quorum (Raft)         │    │
   │  │  [Controller1] [Controller2] [Controller3] │    │
   │  │   (can be same nodes in small clusters)    │    │
   │  └───────────────────────────────────────────┘    │
   └───────────────────────────────────────────────────┘

Benefits:
  ✅ No separate Zookeeper cluster to manage
  ✅ Sub-second failover (Raft consensus)
  ✅ 1M+ partition support
  ✅ Faster startup and rebalancing
```

```bash
# Check KRaft cluster ID (Homebrew Kafka uses KRaft by default)
kafka-storage info --bootstrap-server localhost:9092

# Our local setup:
# Port 9092 → Broker
# Port 9093 → KRaft Controller
# Config: /opt/homebrew/etc/kafka/server.properties
```

---

## Demo Files in This POC

| File | What it teaches |
|------|----------------|
| `producer.js` | Keyed messages, idempotent producer, partition routing |
| `consumer.js` | Consumer groups, offset management, graceful shutdown |
| `partition_experiment.js` | Hash routing, round-robin, partition count effects |
| `offset_explorer.js` | Offset inspection, lag, seeking, time travel |
| `consumer_group_race.js` | Parallel consumers, partition assignment, rebalancing |
| `dead_letter_topic.js` | Retry logic, poison message handling, DLT pattern |
| `structured_logger.js` | Kafka as log sink, multi-service fan-in, alerting |
| `kafka_config_experiment.js` | Live config changes, compression, retention, production config |

---

*Built with Apache Kafka 4.2.0 (KRaft) + kafkajs on Node.js*
