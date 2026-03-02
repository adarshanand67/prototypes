# RabbitMQ — Proof of Concept

> Publisher/Subscriber demo using **AMQP 0-9-1** via `amqplib` (Node.js).  
> Covers: message publishing, durable queues, prefetch QoS, manual ACK, graceful shutdown.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. (Optional) verify RabbitMQ is running
brew services list | grep rabbitmq
curl -s -u guest:guest http://localhost:15672/api/overview | python3 -m json.tool

# 3. Terminal A — start subscriber first (will wait for messages)
node subscriber.js

# 4. Terminal B — publish 10 events
node publisher.js
```

---

## Files

| File                 | Purpose                                                       |
|----------------------|---------------------------------------------------------------|
| `publisher.js`       | Publishes 10 user/order events to `demo_queue` (300ms apart) |
| `subscriber.js`      | Consumes messages, processes by event type, ACKs each one    |
| `schema_diagram.md`  | ASCII + Mermaid architecture diagrams                         |
| `package.json`       | Node.js project config                                        |

---

## Design Decisions

| Choice                     | Reason                                                           |
|----------------------------|------------------------------------------------------------------|
| **Durable queue**          | Queue survives RabbitMQ restarts                                 |
| **Persistent messages**    | Messages survive broker restarts (deliveryMode=2)                |
| **Manual ACK** (`noAck:false`) | Message stays in queue until subscriber explicitly ACKs it  |
| **Prefetch = 5**           | QoS: consumer won't be overwhelmed; back-pressure handled        |
| **Default exchange (direct)** | Simplest routing — message goes straight to queue by name    |

---

## CLI — RabbitMQ Commands

### Service Management
```bash
# Start/stop/restart
brew services start rabbitmq
brew services stop rabbitmq
brew services restart rabbitmq

# Check status
brew services list | grep rabbitmq
```

### `rabbitmqctl` — Admin CLI
```bash
# Queue info
rabbitmqctl list_queues name messages consumers memory

# All queues
rabbitmqctl list_queues

# List exchanges
rabbitmqctl list_exchanges

# List bindings
rabbitmqctl list_bindings

# Active connections
rabbitmqctl list_connections

# Active consumers
rabbitmqctl list_consumers

# Purge a queue (delete all messages)
rabbitmqctl purge_queue demo_queue

# Delete a queue
rabbitmqctl delete_queue demo_queue

# Cluster status
rabbitmqctl cluster_status

# Node status
rabbitmqctl status
```

### `rabbitmqadmin` — HTTP API CLI (from management plugin)
```bash
# First time: download rabbitmqadmin from the management UI
curl -sO http://localhost:15672/cli/rabbitmqadmin
chmod +x rabbitmqadmin

# List queues
./rabbitmqadmin list queues

# List messages (peek without consuming)
./rabbitmqadmin get queue=demo_queue count=5

# Publish a test message
./rabbitmqadmin publish routing_key=demo_queue payload='{"test": true}'

# Delete a queue
./rabbitmqadmin delete queue name=demo_queue
```

### Management HTTP API (REST)
```bash
# Overview
curl -s -u guest:guest http://localhost:15672/api/overview

# List queues
curl -s -u guest:guest http://localhost:15672/api/queues | python3 -m json.tool

# Queue detail
curl -s -u guest:guest http://localhost:15672/api/queues/%2F/demo_queue | python3 -m json.tool

# Connections
curl -s -u guest:guest http://localhost:15672/api/connections | python3 -m json.tool
```

---

## GUI — Management UI

Open: **http://localhost:15672**  
Login: `guest` / `guest`

| Tab          | What to Look At                                     |
|--------------|-----------------------------------------------------|
| **Overview** | Message rates (publish/deliver/ack per second)      |
| **Queues**   | Depth of `demo_queue`, consumer count, message rate |
| **Exchanges**| Routing rules, bindings                             |
| **Connections** | Active AMQP connections from publisher/subscriber|
| **Channels** | Per-channel stats, prefetch settings               |

---

## Ports Reference

| Service              | Port  | Protocol |
|----------------------|-------|----------|
| AMQP (main)          | 5672  | TCP      |
| AMQP/TLS             | 5671  | TCP/TLS  |
| Management UI (HTTP) | 15672 | HTTP     |
| Management UI (HTTPS)| 15671 | HTTPS    |
| STOMP                | 61613 | TCP      |
| MQTT                 | 1883  | TCP      |

---

## RabbitMQ Config

- **Config file**: `/opt/homebrew/etc/rabbitmq/rabbitmq.conf`
- **Env file**: `/opt/homebrew/etc/rabbitmq/rabbitmq-env.conf`
- **Log files**: `/opt/homebrew/var/log/rabbitmq/`
- **Data dir**: `/opt/homebrew/var/lib/rabbitmq/`
- **Erlang cookie**: `/var/folders/.../.erlang.cookie`

---

## Next Steps

- [ ] **Dead Letter Exchange (DLX)**: Route failed messages to a `demo_dead_letter` queue
- [ ] **Topic Exchange**: Use `*.order.*` pattern routing for microservice fan-out
- [ ] **Work Queue pattern**: Multiple subscriber instances competing for messages (round-robin)
- [ ] **RPC pattern**: Request/reply over queues using `replyTo` + `correlationId`
- [ ] **Amazon SQS** (coming soon): Same publisher/subscriber model on AWS managed infrastructure
