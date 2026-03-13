# NoSQL Databases — Complete Guide

> A hands-on reference for 6 NoSQL databases: what they are, how they think, when to use them, and how to use them.

## Databases Covered

| Database | Type | Port | GUI |
|---|---|---|---|
| [MongoDB](#-mongodb--document-store) | Document Store | 27017 | Compass → `mongodb://localhost:27017` |
| [Redis](#-redis--key-value-store) | Key-Value Store | 6379 | RedisInsight → `localhost:6379` |
| [Neo4j](#-neo4j--graph-database) | Graph Database | 7687 / 7474 | Browser → `http://localhost:7474` |
| [Cassandra](#-cassandra--wide-column-store) | Wide-Column Store | 9042 | TablePlus / DBeaver → `localhost:9042` |
| [InfluxDB](#-influxdb--time-series-database) | Time-Series DB | 8181 | Web UI → `http://localhost:8181` |
| [Elasticsearch](#-elasticsearch--search-engine) | Search Engine | 9200 | Kibana → `http://localhost:5601` |

---

## 🍃 MongoDB — Document Store

### What is it?
MongoDB stores data as **JSON-like documents** (called BSON). Instead of rows in tables, you have documents in collections. A document can hold nested objects and arrays — no schema enforced by default.

### The Mental Model
Think of it as a **filing cabinet**: each drawer is a collection, each file is a document. Files can have different shapes — one user doc might have 3 fields, another 30, and that's fine.

### When to Use MongoDB
✅ Content management systems (blogs, CMS, catalogs)  
✅ User profiles with variable attributes  
✅ Rapid prototyping (schema flexibility)  
✅ Hierarchical / nested data (comments inside posts)  
✅ E-commerce product catalogs (varying attributes per product)  

❌ Don't use for: complex multi-document transactions, strict relational integrity, time-series, graph traversals

### Core Concepts
| Concept | SQL Equivalent | Description |
|---|---|---|
| Database | Database | Namespace grouping collections |
| Collection | Table | Group of documents |
| Document | Row | Single JSON object |
| Field | Column | Key-value pair in a document |
| `_id` | Primary Key | Auto-generated unique identifier |
| Index | Index | Speeds up queries |

### Connect & Seed
```bash
mongosh                          # start interactive shell
mongosh social_network           # connect to DB directly
mongosh < mongodb/seed.js        # re-run seed
```

### Essential Commands

```javascript
// ── Database Navigation ──────────────────────────────
use("social_network")          // switch database
show dbs                       // list all databases
show collections               // list collections in current DB
db.stats()                     // DB stats

// ── CRUD ─────────────────────────────────────────────
// Create
db.users.insertOne({ name: "Adarsh", city: "Bangalore" })
db.users.insertMany([{ name: "Alice" }, { name: "Bob" }])

// Read
db.users.find()                               // all docs
db.users.find({ "location.city": "London" }) // filter
db.users.find({ age: { $gt: 25 } })          // comparison
db.users.find({ hobbies: "hiking" })          // array contains
db.users.findOne({ username: "alice_j" })     // first match
db.users.find().sort({ followers: -1 }).limit(3) // sort + paginate
db.users.find({}, { name: 1, email: 1 })     // projection (select fields)

// Update
db.users.updateOne({ username: "alice_j" }, { $set: { city: "NYC" } })
db.users.updateOne({ username: "alice_j" }, { $inc: { followers: 1 } })
db.users.updateMany({ verified: false }, { $set: { status: "pending" } })

// Delete
db.users.deleteOne({ username: "alice_j" })
db.users.deleteMany({ age: { $lt: 18 } })

// ── Aggregation Pipeline ─────────────────────────────
// Like SQL GROUP BY, but chained as pipeline stages

// Posts per tag
db.posts.aggregate([
  { $unwind: "$tags" },
  { $group: { _id: "$tags", count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 5 }
])

// Join users to their posts ($lookup = LEFT JOIN)
db.posts.aggregate([
  { $lookup: {
    from: "users",
    localField: "authorId",
    foreignField: "_id",
    as: "author"
  }},
  { $unwind: "$author" },
  { $project: { title: 1, "author.name": 1, likes: 1 } },
  { $sort: { likes: -1 } }
])

// Average likes per user
db.posts.aggregate([
  { $group: { _id: "$authorId", avgLikes: { $avg: "$likes" }, totalPosts: { $sum: 1 } } }
])

// ── Indexes ───────────────────────────────────────────
db.users.createIndex({ username: 1 }, { unique: true })  // unique index
db.posts.createIndex({ tags: 1 })                        // array index
db.posts.createIndex({ createdAt: -1 })                  // descending
db.posts.createIndex({ title: "text", content: "text" }) // full-text search

// Check index usage
db.posts.find({ tags: "backend" }).explain("executionStats")

// ── Full-Text Search ──────────────────────────────────
db.posts.createIndex({ title: "text", content: "text" })
db.posts.find({ $text: { $search: "Redis caching" } })
db.posts.find({ $text: { $search: "\"graph database\"" } }) // exact phrase
```

### Data in This Project
```
social_network/
  users      → 5 documents (alice_j, bob_m, priya_s, carlos_r, emma_w)
  posts      → 5 documents (tech blog posts, with tags + likes)
  comments   → 5 documents (nested comment data)
```

---

## 🔴 Redis — Key-Value Store

### What is it?
Redis is an **in-memory data structure store**. Everything lives in RAM, making it extremely fast (sub-millisecond). It supports rich data types beyond simple strings. Data can be made persistent or purely ephemeral with TTL.

### The Mental Model
Think of it as a **super-fast dictionary** (hashmap) where each key maps to a value. The value can be a string, list, set, sorted set, hash, bitmap, or more. It's not really for primary storage — it's for things where **speed is everything**: caches, sessions, real-time rankings, pub/sub.

### When to Use Redis
✅ Session storage / authentication tokens  
✅ Caching API responses, computed data  
✅ Real-time leaderboards / rankings  
✅ Rate limiting (atomic INCR + EXPIRE)  
✅ Pub/Sub messaging  
✅ Job queues  
✅ Counting (page views, votes)  

❌ Don't use for: primary data storage of large volumes, complex queries, relationships

### Connect & Seed
```bash
redis-cli                       # interactive shell
redis-cli ping                  # → PONG if healthy
bash redis/seed.sh              # re-run seed (FLUSHALL first)
```

### Essential Commands

```bash
# ── Strings ───────────────────────────────────────────
SET key value
SET key value EX 60             # with 60s TTL
GET key
DEL key
INCR counter                    # atomic increment
INCRBY counter 5
TTL key                         # remaining time-to-live (-1 = no TTL)
EXPIRE key 300                  # set TTL on existing key
PERSIST key                     # remove TTL

# ── Hashes (objects) ──────────────────────────────────
HSET user:1 name "Alice" age 28 city "SF"
HGET user:1 name
HGETALL user:1                  # full object
HMGET user:1 name age           # multiple fields
HINCRBY user:1 followers 1
HDEL user:1 bio

# ── Lists (ordered, duplicates allowed) ───────────────
LPUSH feed:alice "New event"    # push to front
RPUSH queue "job1" "job2"       # push to back
LRANGE feed:alice 0 -1          # all items
LRANGE feed:alice 0 4           # first 5
LPOP queue                      # dequeue (remove + return from front)
RPOPLPUSH src dst               # move between lists atomically
LLEN feed:alice                 # length

# ── Sets (unique members) ─────────────────────────────
SADD followers:alice "bob" "priya"
SMEMBERS followers:alice        # all members
SISMEMBER followers:alice bob   # check membership (0 or 1)
SCARD followers:alice           # count
SINTER followers:alice followers:priya  # intersection (mutual)
SUNION followers:alice followers:bob    # union
SDIFF followers:alice followers:bob     # difference

# ── Sorted Sets (score-ranked, unique members) ────────
ZADD leaderboard 1204 "Dark Mode UX"
ZADD leaderboard 891 "Graph DBs"
ZREVRANGE leaderboard 0 4 WITHSCORES  # top 5 with scores
ZRANK leaderboard "Graph DBs"         # rank (0-indexed, asc)
ZREVRANK leaderboard "Graph DBs"      # rank (desc)
ZINCRBY leaderboard 10 "Graph DBs"    # add to score
ZRANGEBYSCORE leaderboard 500 1000    # in score range

# ── Key Management ────────────────────────────────────
KEYS '*'                        # all keys (use SCAN in prod!)
SCAN 0 MATCH "user:*" COUNT 100 # safer iteration
TYPE key                        # string/hash/list/set/zset
OBJECT ENCODING key             # internal encoding
RENAME old new
EXISTS key
OBJECT HELP

# ── Pub/Sub ───────────────────────────────────────────
# Terminal 1:
SUBSCRIBE notifications
# Terminal 2:
PUBLISH notifications "User alice logged in"
```

### Data Types Summary
| Type | Use Case | Example Key |
|---|---|---|
| String | Sessions, counters, flags | `session:alice`, `counter:views` |
| Hash | Objects/structs | `user:1`, `product:42` |
| List | Feeds, queues (FIFO/LIFO) | `feed:alice`, `queue:emails` |
| Set | Unique collections, set ops | `followers:alice`, `online_users` |
| Sorted Set | Leaderboards, time rankings | `leaderboard:posts` |
| Bitmap | Compact boolean flags | `dau:2024-02-28` |

### Data in This Project
```
20 keys across 7 data type patterns:
  session:alice/bob/priya    → JWT tokens with 1h TTL
  user:1/2/3                 → hash profile objects
  feed:alice                 → activity list (5 events)
  followers:alice/bob/priya  → follower sets
  leaderboard:top_posts      → sorted by likes
  ranking:daily_posts        → users by post count
  cache:trending_posts       → 5-min cached JSON
  dau:2024-02-28             → bitmap (3 DAU)
```

---

## 🔵 Neo4j — Graph Database

### What is it?
Neo4j stores data as a **graph of nodes and relationships**. Instead of tables or documents, you have entities (nodes) connected by typed, directional relationships — and both nodes AND relationships can have properties.

### The Mental Model
Think of it as a **network map** — like a city subway system. Each station is a node, each line between stations is a relationship. You can ask: "What's the fastest way from A to B?" or "Who are all the friends-of-friends of Alice?"

### When to Use Neo4j
✅ Social networks (followers, friends, recommendations)  
✅ Fraud detection (finding unusual connection patterns)  
✅ Knowledge graphs  
✅ Recommendation engines ("people who liked X also liked Y")  
✅ Network/IT infrastructure mapping  
✅ Any domain with highly connected, relationship-heavy data  

❌ Don't use for: simple key-value lookups, time-series, bulk analytics on flat data

### Connect & Seed
```bash
cypher-shell -u neo4j -p nosql1234         # interactive CLI
# then type Cypher queries ending with ;
cypher-shell -u neo4j -p nosql1234 -f neo4j/seed.cypher  # re-seed
# GUI: http://localhost:7474
```

### Essential Cypher Queries

```cypher
-- ── CREATE ────────────────────────────────────────────
CREATE (p:Person {name: 'Alice', age: 28})
CREATE (m:Movie {title: 'Inception', year: 2010})
CREATE (alice)-[:FOLLOWS {since: date('2024-01-01')}]->(bob)

-- MERGE = create only if doesn't exist (upsert)
MERGE (p:Person {username: 'alice_j'})
SET p.verified = true

-- ── READ / MATCH ──────────────────────────────────────
-- All people
MATCH (p:Person) RETURN p

-- Filter
MATCH (p:Person) WHERE p.age > 25 RETURN p.name, p.age

-- Pattern matching (who follows who)
MATCH (a:Person)-[:FOLLOWS]->(b:Person)
RETURN a.name AS follower, b.name AS following

-- Who does Alice follow?
MATCH (a:Person {username:'alice_j'})-[:FOLLOWS]->(b)
RETURN b.name, b.city

-- Movies Alice reviewed
MATCH (a:Person {username:'alice_j'})-[r:REVIEWED]->(m:Movie)
RETURN m.title, r.rating, r.review

-- ── PATH QUERIES ─────────────────────────────────────
-- Friends of friends (2 hops)
MATCH (a:Person {username:'alice_j'})-[:FOLLOWS*2]->(fof)
WHERE fof.username <> 'alice_j'
RETURN DISTINCT fof.name

-- Variable-length path (1 to 3 hops)
MATCH (a:Person {username:'alice_j'})-[:FOLLOWS*1..3]->(connected)
RETURN DISTINCT connected.name

-- Shortest path between two people
MATCH path = shortestPath(
  (a:Person {username:'bob_m'})-[*]-(b:Person {username:'priya_s'})
)
RETURN path, length(path) AS hops

-- All paths (careful on large graphs)
MATCH path = allShortestPaths(
  (a:Person {username:'alice_j'})-[*]-(b:Person {username:'carlos_r'})
)
RETURN path

-- ── AGGREGATION ───────────────────────────────────────
-- Top rated movies
MATCH (p:Person)-[r:REVIEWED]->(m:Movie)
RETURN m.title, avg(r.rating) AS avg_rating, count(r) AS num_reviews
ORDER BY avg_rating DESC

-- Most followed people
MATCH (p:Person)<-[:FOLLOWS]-(follower)
RETURN p.name, count(follower) AS follower_count
ORDER BY follower_count DESC

-- ── RECOMMENDATIONS ───────────────────────────────────
-- Movies friends liked that Alice hasn't seen
MATCH (me:Person {username:'alice_j'})-[:FOLLOWS]->(friend)-[:REVIEWED]->(m:Movie)
WHERE NOT (me)-[:REVIEWED]->(m)
RETURN m.title, count(friend) AS friends_who_liked, avg(friend.rating) AS avg_score
ORDER BY friends_who_liked DESC

-- ── DELETE ────────────────────────────────────────────
MATCH (p:Person {username:'temp'}) DELETE p             -- delete node (no relationships)
MATCH (p:Person {username:'temp'}) DETACH DELETE p      -- delete + all its relationships
MATCH ()-[r:FOLLOWS]->() WHERE r.since < date('2023-01-01') DELETE r
```

### Data in This Project
```
Nodes:    5 × Person (alice_j, bob_m, priya_s, carlos_r, emma_w)
          5 × Movie  (Inception, The Matrix, Interstellar, Parasite, Dune)
Edges:    10 × FOLLOWS   (who follows who)
          10 × REVIEWED  (Person→Movie, with rating + review text)
           4 × FRIENDS_WITH (bidirectional friendships)
```

---

## 📊 Cassandra — Wide-Column Store

### What is it?
Cassandra stores data in **tables with rows and columns** — but unlike SQL, the columns per row are flexible, and the real power lies in how you distribute data. It's designed for **massive scale** and **no single point of failure** across multiple datacenters.

### The Mental Model
Think of it as a **distributed dictionary of sorted maps**. The partition key determines which node stores the data. The clustering key determines the sort order within a partition. You model data around your **queries first**, not entities first.

### The Golden Rule of Cassandra
> **"Model your data around your queries, not your domain."**

In SQL, you normalize data and JOIN at query time. In Cassandra, you **denormalize** — you have one table per query pattern, and you duplicate data. This is by design for performance.

### When to Use Cassandra
✅ Write-heavy workloads at massive scale  
✅ Time-ordered data per entity (events, logs per user)  
✅ Multi-region, always-available systems  
✅ IoT data, clickstream data  
✅ User activity feeds  

❌ Don't use for: ad-hoc queries (no full table scans), complex aggregations, JOINs, small datasets (overkill), ACID transactions across multiple partitions

### Connect & Seed
```bash
cqlsh                           # interactive CQL shell
cqlsh -e "DESCRIBE KEYSPACES;"  # one-liner
cqlsh -f cassandra/seed.cql     # run seed file
```

### Essential CQL Commands

```sql
-- ── Keyspace (= database) ─────────────────────────────
CREATE KEYSPACE social_network
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE social_network;
DESCRIBE KEYSPACES;
DESCRIBE TABLES;
DESCRIBE TABLE users;

-- ── Table Design (with partition + clustering keys) ───
-- Partition key  → determines which node holds the data
-- Clustering key → sort order within a partition

-- Simple table
CREATE TABLE users (
  user_id UUID PRIMARY KEY,     -- partition key only
  name TEXT,
  email TEXT
);

-- Composite primary key (partition + clustering)
CREATE TABLE posts_by_user (
  author_id  UUID,
  created_at TIMESTAMP,
  post_id    UUID,
  title      TEXT,
  PRIMARY KEY (author_id, created_at, post_id)  -- author_id = partition, rest = clustering
) WITH CLUSTERING ORDER BY (created_at DESC);   -- newest first within each user's partition

-- ── CRUD ─────────────────────────────────────────────
-- Insert
INSERT INTO users (user_id, name, email, city)
VALUES (uuid(), 'Alice', 'alice@example.com', 'SF');

-- Select (MUST provide partition key!)
SELECT * FROM users;                                -- fine (small table)
SELECT * FROM posts_by_user WHERE author_id = ?;   -- efficient (partition key provided)
SELECT * FROM posts_by_user
  WHERE author_id = 11111111-1111-1111-1111-111111111101
  ORDER BY created_at DESC LIMIT 10;               -- latest posts for a user

-- Update (actually an upsert in Cassandra)
UPDATE users SET followers = followers + 1
WHERE user_id = 11111111-1111-1111-1111-111111111101;

-- Delete
DELETE FROM users WHERE user_id = ?;
DELETE email FROM users WHERE user_id = ?;   -- delete a single field

-- TTL (auto-expire rows)
INSERT INTO activity_feed (user_id, event_time, event_id, event_type, message)
VALUES (?, toTimestamp(now()), uuid(), 'like', 'bob liked your post')
USING TTL 604800;  -- expire in 7 days

-- ── Useful CQL Functions ──────────────────────────────
SELECT uuid();            -- generate UUID
SELECT now();             -- current time
SELECT toTimestamp(now()); -- timestamp
SELECT dateOf(now());     -- date

-- ── Collections ───────────────────────────────────────
-- SET (unique items)
UPDATE users SET hobbies = hobbies + {'yoga'} WHERE user_id = ?;
UPDATE users SET hobbies = hobbies - {'gaming'} WHERE user_id = ?;

-- LIST
UPDATE users SET tags = tags + ['new_tag'] WHERE user_id = ?;

-- MAP
UPDATE users SET metadata = metadata + {'plan': 'pro'} WHERE user_id = ?;
```

### Key Design Patterns in This Project
| Query | Table Used | Why |
|---|---|---|
| Get all posts by user | `posts_by_user` | Partition by `author_id` |
| Get posts with tag | `posts_by_tag` | Partition by `tag` |
| Who does user X follow? | `user_follows` | Partition by `follower_id` |
| Who follows user X? | `user_followers` | Partition by `user_id` |
| User's activity feed | `activity_feed` | Partition by `user_id`, cluster by time |

### Data in This Project
```
social_network keyspace:
  users            → 5 rows
  posts_by_user    → 6 rows (partitioned by author)
  posts_by_tag     → 4 rows (partitioned by tag)
  user_follows     → 5 rows
  user_followers   → 5 rows
  activity_feed    → 3 rows (for Alice)
```

---

## 📈 InfluxDB — Time-Series Database

### What is it?
InfluxDB is purpose-built for **time-stamped data**. Every data point has a timestamp, measurements, tags (indexed metadata), and fields (values). It's optimized for ingesting millions of writes per second and querying time ranges efficiently.

### The Mental Model
Think of it like a **sensor log or metrics system**. Each data point says: *"At this exact moment in time, sensor X in location Y had value Z."* InfluxDB automatically organizes and compresses data by time, and old data can auto-expire (retention policies).

### When to Use InfluxDB
✅ IoT sensor data (temperature, pressure, humidity)  
✅ Application performance monitoring (CPU, memory, latency)  
✅ Financial tick data  
✅ Real-time dashboards / alerting  
✅ Log metrics and aggregations over time  

❌ Don't use for: document storage, relationships, general-purpose querying

### Key Concepts
| Concept | Description | SQL Analogy |
|---|---|---|
| Database | Top-level namespace | Database |
| Measurement | Type of data being recorded | Table |
| Tags | Indexed string metadata | Indexed VARCHAR columns |
| Fields | Actual numeric/string values | Non-indexed columns |
| Timestamp | When the point was recorded | Always present, the primary key |
| Line Protocol | The write format: `measurement,tag=val field=val timestamp` | INSERT syntax |

### Connect & Seed
```bash
# Start InfluxDB 3
influxdb3 serve --node-id local --object-store file --data-dir ~/.influxdb3

# Create admin token (once)
influxdb3 create token --admin --host http://localhost:8181

# Write data
influxdb3 write --host http://localhost:8181 \
  --database iot_sensors \
  --token <YOUR_TOKEN> \
  "temperature,sensor_id=sensor-01,location=office value=22.5"

# Query  
influxdb3 query --host http://localhost:8181 \
  --database iot_sensors \
  --token <YOUR_TOKEN> \
  "SELECT * FROM temperature ORDER BY time DESC LIMIT 10"

# Re-run seed
bash influxdb/seed.sh
```

> **Your Token:** `apiv3_B7OJSOSuR_IIum6jaQs4jUARFfEa1QmY5Boz8VaPbfwb0H51TDRCDGCYLY1ZPc00SzL0EvVW6nlQ8tILHzd59w`

### Line Protocol Format
```
# measurement,tag_key=tag_val field_key=field_val unix_timestamp_ns
temperature,sensor_id=sensor-01,location=server_room value=22.4 1709000000000000000

# Multiple fields
cpu_usage,host=web-01,region=us-west idle=78.5,user=15.2,system=6.3
#                                     └──────────────────────────── fields (actual values)
#                      └────────────────── tags (indexed metadata for filtering)
# └────────────────── measurement name
```

### Essential SQL Queries (InfluxDB 3 uses SQL!)
```sql
-- All temperature readings
SELECT * FROM temperature ORDER BY time DESC LIMIT 20;

-- Filter by tag
SELECT time, sensor_id, value FROM temperature
WHERE sensor_id = 'sensor-01' ORDER BY time DESC LIMIT 10;

-- Range query (most common in time-series)
SELECT time, value FROM temperature
WHERE time >= now() - INTERVAL '1 hour'
ORDER BY time DESC;

-- Downsample: average per 10-minute window (statistical aggregation)
SELECT
  date_bin(INTERVAL '10 minutes', time, TIMESTAMP '1970-01-01') AS window,
  sensor_id,
  avg(value) AS avg_temp,
  max(value) AS max_temp,
  min(value) AS min_temp
FROM temperature
GROUP BY window, sensor_id
ORDER BY window DESC;

-- CPU metrics per host
SELECT time, host, user, idle, system FROM cpu_usage
WHERE host = 'db-01' ORDER BY time DESC LIMIT 10;

-- HTTP error rate
SELECT status, sum(count) AS total_requests
FROM http_requests
GROUP BY status;
```

### Data in This Project
```
Database: iot_sensors
  temperature   → 15 readings (2 sensors, past hour)
  humidity      → 6 readings (1 sensor, past hour)
  cpu_usage     → 9 readings (3 hosts × time)
  http_requests → 10 readings (multiple endpoints)
```

---

## 🔍 Elasticsearch — Search Engine

### What is it?
Elasticsearch is a **distributed full-text search and analytics engine** built on Apache Lucene. It excels at indexing text and making it searchable in milliseconds — but it also does structured queries, aggregations, and is the heart of the ELK stack (with Logstash for ingesting and Kibana for visualization).

### The Mental Model
Think of it as a **Google for your data**. You index documents (JSON), and then you can search them with full-text search, fuzzy matching, filters, relevance scoring, faceting, and aggregations — all very fast across millions of documents.

### When to Use Elasticsearch
✅ Full-text search (search bars, autocomplete)  
✅ Log analysis and observability (ELK stack)  
✅ E-commerce product search with filters/facets  
✅ Analytics dashboards on large datasets  
✅ Geospatial search  

❌ Don't use for: primary data store (ES is eventually consistent), heavy write workloads, ACID transactions

### Connect & Seed
```bash
# Start services
brew services start elastic/tap/elasticsearch-full
brew services start elastic/tap/kibana-full

# Test connection
curl http://localhost:9200

# Index a document
curl -X POST http://localhost:9200/posts/_doc \
  -H 'Content-Type: application/json' \
  -d '{"title":"Getting Started","content":"Elasticsearch is amazing","tags":["search"]}'

# GUI: http://localhost:5601 (Kibana — wait ~60s for startup)

# Re-run seed
bash elasticsearch/seed.sh
```

### Key Concepts
| Concept | Description | SQL Analogy |
|---|---|---|
| Index | Collection of documents | Table |
| Document | JSON object | Row |
| Field | Key-value inside document | Column |
| Mapping | Schema definition | DDL |
| Shard | Distributed partition | Partition |
| Replica | Copy for fault tolerance | Replica |

### Essential REST API Commands
```bash
# ── Cluster Health ───────────────────────────────────
curl http://localhost:9200
curl http://localhost:9200/_cat/indices?v        # list all indexes
curl http://localhost:9200/_cat/health?v         # cluster health

# ── Create Index with Mapping ─────────────────────────
curl -X PUT http://localhost:9200/posts \
  -H 'Content-Type: application/json' -d '{
  "mappings": {
    "properties": {
      "title":     { "type": "text" },
      "content":   { "type": "text" },
      "tags":      { "type": "keyword" },
      "author":    { "type": "keyword" },
      "likes":     { "type": "integer" },
      "createdAt": { "type": "date" }
    }
  }
}'

# ── Index Documents ───────────────────────────────────
curl -X POST http://localhost:9200/posts/_doc \
  -H 'Content-Type: application/json' -d '{
    "title": "Why Graph Databases are Underrated",
    "content": "When data is all about relationships, SQL joins become painful. Neo4j changes everything.",
    "tags": ["neo4j", "database"],
    "author": "priya_s",
    "likes": 891,
    "createdAt": "2024-02-01"
  }'

# Bulk index (efficient)
curl -X POST http://localhost:9200/_bulk \
  -H 'Content-Type: application/x-ndjson' -d '
{"index":{"_index":"posts"}}
{"title":"Redis Best Practices","content":"Redis is blazing fast for sessions.","tags":["redis"],"likes":567}
{"index":{"_index":"posts"}}
{"title":"Dark Mode UX Design","content":"Dark mode reduces eye strain.","tags":["ux","design"],"likes":1204}
'

# ── Search Queries ────────────────────────────────────
# Full-text search
curl -X GET http://localhost:9200/posts/_search \
  -H 'Content-Type: application/json' -d '{
  "query": { "match": { "content": "database" } }
}'

# Multi-field search
curl -X GET http://localhost:9200/posts/_search \
  -H 'Content-Type: application/json' -d '{
  "query": {
    "multi_match": {
      "query": "redis caching",
      "fields": ["title^2", "content"]  // title gets 2x boost
    }
  }
}'

# Filter (exact, no scoring)
curl -X GET http://localhost:9200/posts/_search \
  -H 'Content-Type: application/json' -d '{
  "query": {
    "bool": {
      "must":   [{ "match": { "content": "database" }}],
      "filter": [{ "term": { "tags": "nosql" }},
                 { "range": { "likes": { "gte": 500 }}}]
    }
  }
}'

# Fuzzy search (typo-tolerant)
curl -X GET http://localhost:9200/posts/_search \
  -H 'Content-Type: application/json' -d '{
  "query": { "fuzzy": { "title": { "value": "databse", "fuzziness": "AUTO" }}}
}'

# Aggregations (like GROUP BY)
curl -X GET http://localhost:9200/posts/_search \
  -H 'Content-Type: application/json' -d '{
  "size": 0,
  "aggs": {
    "by_tag": {
      "terms": { "field": "tags", "size": 10 }
    },
    "avg_likes": {
      "avg": { "field": "likes" }
    }
  }
}'
```

### The ELK Stack Flow
```
[Log Sources / Apps]
        ↓
   Logstash          ← Ingests, transforms, enriches logs
        ↓
 Elasticsearch       ← Indexes and stores everything
        ↓
    Kibana           ← Dashboards, search UI, visualizations
```

---

## 🔧 Service Management

```bash
# Check all services
brew services list

# Start / Stop
brew services start mongodb/brew/mongodb-community
brew services start redis
brew services start neo4j
brew services start cassandra
brew services start elastic/tap/elasticsearch-full
brew services start elastic/tap/kibana-full

# InfluxDB 3 (manual — no brew service support)
influxdb3 serve --node-id local --object-store file --data-dir ~/.influxdb3 &

# Ports reference
# MongoDB       → 27017
# Redis         → 6379
# Neo4j         → 7474 (HTTP browser), 7687 (Bolt protocol)
# Cassandra     → 9042 (CQL), 7199 (JMX)
# InfluxDB 3    → 8181
# Elasticsearch → 9200 (HTTP), 9300 (cluster)
# Kibana        → 5601
```

---

## 📚 Choosing the Right Database

| Scenario | Best Choice | Why |
|---|---|---|
| Blog / CMS with flexible schema | MongoDB | Documents fit naturally |
| User session cache | Redis | In-memory, TTL, microsecond reads |
| "Who should I follow?" recommendations | Neo4j | Graph traversal |
| 10M writes/sec of IoT sensor data | Cassandra or InfluxDB | Write-optimized, distributed |
| Server metrics / APM | InfluxDB | Purpose-built time-series |
| "Search for products like..." | Elasticsearch | Full-text + faceted search |
| Log aggregation pipeline | ELK Stack | Ingest→Store→Visualize |

---

## 📂 Project Files

```
nosql_databases/
├── README.md                    ← This file
├── mongodb/
│   └── seed.js                  ← mongosh < mongodb/seed.js
├── redis/
│   └── seed.sh                  ← bash redis/seed.sh
├── neo4j/
│   └── seed.cypher              ← cypher-shell ... -f neo4j/seed.cypher
├── cassandra/
│   └── seed.cql                 ← cqlsh -f cassandra/seed.cql
├── influxdb/
│   └── seed.sh                  ← bash influxdb/seed.sh
└── elasticsearch/
    └── seed.sh                  ← bash elasticsearch/seed.sh (coming soon)
```
