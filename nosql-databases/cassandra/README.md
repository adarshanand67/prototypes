# Cassandra Prototype

This prototype demonstrates a **wide-column store NoSQL database** using Apache Cassandra, optimized for high-volume, time-series data and partition-based scaling.

---

## 🏗️ Distributed Architecture

![Cassandra Architecture](/Users/adarsh_anand/.gemini/antigravity/brain/f8425b5e-dd7a-47a3-a44a-818d6fc30623/cassandra_schema_diagram_1772470967765.png)

---

## 📄 Data Modeling (CQL)

The prototype uses the `social_network` keyspace and demonstrates partition-key based distribution.

### Schema Overview:
- **Keyspace**: `social_network`
- **Replication**: `SimpleStrategy` with factor 1 (for demo).
- **Tables**:
    - `users`: Standard user profiles.
    - `user_activity`: Wide-column table for tracking events, partitioned by `user_id`.

---

## 🚀 Running the Script

### Prerequisites
- Cassandra running locally (or via Docker).

### Seeding Data
Use `cqlsh` to execute the seed script:

```bash
cqlsh -f nosql_databases/cassandra/seed.cql
```

### Verification
Connect to `cqlsh` and query the data:

```sql
USE social_network;
SELECT * FROM users;
SELECT * FROM user_activity WHERE user_id = 'u001';
```

---

## 🔍 Key Performance Factors
- **Partition Key**: The `user_id` ensures all activity for a user is stored on the same set of nodes, enabling fast range scans.
- **Clustering Columns**: Data in `user_activity` is sorted by `activity_time` DESC, perfect for "last N activities" queries.
- **LSM Tree Storage**: Optimized for high write throughput.
