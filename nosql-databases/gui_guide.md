# GUI Guide: Working with NoSQL & ELK (Free Setup)

Since "Universal" tools like DBeaver Pro often require a paid license for NoSQL, I've set you up with the **best-in-class free specialized tools**. These provide the richest features for each database without a paywall.

## 📁 1. MongoDB: MongoDB Compass
**Status**: Installed.
1.  Open **MongoDB Compass**.
2.  **Connection String**: `mongodb://localhost:27017`
3.  Click **Connect**. You can browse documents, run aggregation pipelines, and view indexes.

## 📁 2. Redis: RedisInsight
**Status**: Installed.
1.  Open **RedisInsight**.
2.  Click **Add Redis Database** → **Connect to a Redis Database**.
3.  **Host**: `localhost` | **Port**: `6379`.
4.  You can view all data types (Hashes, Sets, Lists) and use the built-in CLI.

## 📁 3. Cassandra: TablePlus (Free Tier)
**Status**: Installed.
TablePlus supports Cassandra in its free version (limited to 2 open tabs).
1.  Open **TablePlus**.
2.  Click **Create a new connection...** → Select **Cassandra**.
3.  **Host**: `localhost` | **Port**: `9042`.
4.  Expand `social_network` to browse your tables.

---

## 🔍 4. Search & Graph (Web-Based)

These are built into the services and are fully free.

### Elasticsearch: Kibana
- **Access**: [http://localhost:5601](http://localhost:5601)
- Use **Dev Tools** to run queries like `GET /posts/_search`.

### Neo4j: Neo4j Browser
- **Access**: [http://localhost:7474](http://localhost:7474)
- Login: `neo4j` / `nosql1234`.

---

## 📈 5. Time-Series: InfluxDB 3
**Access**: [http://localhost:8181](http://localhost:8181) (API)

**Note**: InfluxDB 3 (Homebrew) is CLI/SQL focused and lacks a built-in dashboard.
- To "see" data, run the `influxdb/seed.sh` script to trigger a sample query.
- You can also query it via terminal:
  ```bash
  curl -X POST "http://localhost:8181/api/v2/query?db=iot_sensors"
  ```

---

## 📊 6. Dashboards: Grafana
**Access**: [http://localhost:3000](http://localhost:3000)
**Default Login**: `admin` / `admin` (You will be asked to change this on first login).

Grafana is the perfect "Dashboard" layer for your NoSQL stack.

### How to visualize your data:
1.  **InfluxDB**:
    - Add Data Source → **InfluxDB**.
    - **Query Language**: SQL or Flux.
    - **URL**: `http://localhost:8181`.
2.  **Elasticsearch**:
    - Add Data Source → **Elasticsearch**.
    - **URL**: `http://localhost:9200`.
    - **Index**: `posts`.

---

## Summary of Free Tools

| Database | Free Tool | Why it's better than DBeaver Free? |
|---|---|---|
| **MongoDB** | **Compass** | Supports aggregation UI, schema analysis, and visual indexing. |
| **Redis** | **RedisInsight** | Native support for all Redis data types and memory analysis. |
| **Cassandra** | **TablePlus** | Supports Cassandra without needing to manually add JDBC drivers. |
| **Search/Logs**| **Grafana** | Create beautiful dashboards for InfluxDB and Elasticsearch. |
