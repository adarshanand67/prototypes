# InfluxDB Prototype

This prototype demonstrates a **time-series database (TSDB)** using InfluxDB, optimized for high-write loads and time-centric queries.

---

## 🏗️ Time-Series Architecture

![InfluxDB Time-Series](/Users/adarsh_anand/.gemini/antigravity/brain/f8425b5e-dd7a-47a3-a44a-818d6fc30623/influxdb_time_series_1772471661684.png)

---

## 📄 Data Model

The prototype uses the line protocol format to ingest data.

### Concepts:
- **Measurement**: `cpu_usage`, `memory_stats` (like a SQL table).
- **Tags**: `host`, `region` (indexed metadata).
- **Fields**: `value`, `load` (non-indexed data).
- **Timestamp**: Essential for time-series data.

---

## 🚀 Running the Script

### Prerequisites
- InfluxDB v2.x running locally.
- Influx CLI installed.

### Seeding Data
Run the `seed.sh` script to ingest sample metrics:

```bash
chmod +x nosql_databases/influxdb/seed.sh
./nosql_databases/influxdb/seed.sh
```

### Verification
Use the InfluxDB UI (typically at `localhost:8086`) or the CLI to query the data via Flux:

```flux
from(bucket: "metrics")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "cpu_usage")
```

---

## 🔍 Key Features Demonstrated
- **High Retention Policies**: Automatically expire old data.
- **Downsampling**: Aggregate data over time for long-term storage.
- **Tag-based Indexing**: Extremely fast filtering by metadata.
