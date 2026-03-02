# Redis Pub/Sub Prototype

Demonstrates **Redis real-time Pub/Sub** — the fire-and-forget messaging model — using modern **ES Modules (ESM)** and `ioredis`.

---

## 📁 Files

| File | Role |
|---|---|
| `publisher.js` | **Producer** — publishes a message every 2 s to the `news` channel |
| `consumer1.js` | **Subscriber #1** 🟢 |
| `consumer2.js` | **Subscriber #2** 🔵 |
| `consumer3.js` | **Subscriber #3** 🟣 |
| `late_subscriber.js` | **Late Subscriber** 🟠 — waits 8 s before joining; misses earlier messages |

---

## 🔑 Key Concepts

| Concept | Behaviour |
|---|---|
| **Fire-and-forget** | Redis does NOT store messages. If no subscriber is listening, the message is lost. |
| **Real-time delivery** | Active subscribers receive the message the instant it is published. |
| **No history** | A subscriber that joins late only receives messages published _after_ it joined. |
| **Fan-out** | A single publish reaches ALL active subscribers simultaneously. |

---

## 🚀 Running the Demo

### Prerequisites
- Redis running locally on `localhost:6379`

```bash
# macOS (Homebrew)
brew services start redis

# or run directly
redis-server
```

> Verify Redis is up: `redis-cli ping` → should return `PONG`

---

### Step 1 — Open 5 terminal tabs

#### Terminal 1 — Publisher
```bash
cd redis-pubsub
node publisher.js
```

#### Terminal 2 — Consumer 1
```bash
node consumer1.js
```

#### Terminal 3 — Consumer 2
```bash
node consumer2.js
```

#### Terminal 4 — Consumer 3
```bash
node consumer3.js
```

#### Terminal 5 — Late Subscriber (start AFTER publisher)
```bash
node late_subscriber.js
```

---

## 🧪 What to Observe

### Consumers 1, 2, 3
- They receive every message from the publisher as soon as they subscribe.
- All three get the **same message simultaneously** (fan-out).

### Late Subscriber
- Waits **8 seconds** before subscribing.
- It will **miss messages #1–#4** (published while it was not yet subscribed).
- First message received will have an ID ≥ 5.
- This proves: **Redis Pub/Sub has zero message history.**

### Publisher output
- Reports how many active subscribers received each message.
- If you kill a consumer, the count drops immediately on the next publish.

---

## 🔍 Inspect with redis-cli (optional)

```bash
# See all active subscribers and channels
redis-cli PUBSUB CHANNELS
redis-cli PUBSUB NUMSUB news

# Manually publish a one-off message
redis-cli PUBLISH news '{"id":99,"text":"Manual message","timestamp":"now"}'
```

---

## 🔄 Architecture

```
┌─────────────────┐
│   publisher.js  │  ← publishes every 2 s
│  (PUBLISH news) │
└────────┬────────┘
         │  Redis Pub/Sub channel: "news"
┌────────▼────────────────────────────────────┐
│                  Redis Server               │
│           (in-memory, no persistence)       │
└───┬──────────────────────┬──────────┬───────┘
    │                      │          │
┌───▼────────┐  ┌──────────▼─┐  ┌────▼───────┐
│ consumer1  │  │ consumer2  │  │ consumer3  │
│   🟢       │  │   🔵       │  │   🟣       │
└────────────┘  └────────────┘  └────────────┘
                                 (late_subscriber joins later → misses history)
```
