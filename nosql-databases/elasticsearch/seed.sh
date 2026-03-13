#!/usr/bin/env bash
# ============================================================
# Elasticsearch Seed Script — Blog Posts & Search Index
# Run with: bash elasticsearch/seed.sh
# ============================================================

ES_URL="http://localhost:9200"

echo "🔍 Elasticsearch Seed — Blog Posts Index"
echo "──────────────────────────────────────────"

# Check if ES is up
if ! curl -s "$ES_URL" > /dev/null; then
  echo "❌ Error: Elasticsearch is not running at $ES_URL"
  exit 1
fi

# Delete existing index
echo "Deleting old 'posts' index..."
curl -s -X DELETE "$ES_URL/posts" > /dev/null

# Create index with mapping
echo "Creating 'posts' index with mappings..."
curl -s -X PUT "$ES_URL/posts" \
  -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  },
  "mappings": {
    "properties": {
      "title":     { "type": "text", "analyzer": "english" },
      "content":   { "type": "text", "analyzer": "english" },
      "tags":      { "type": "keyword" },
      "author":    { "type": "keyword" },
      "likes":     { "type": "integer" },
      "reposts":   { "type": "integer" },
      "createdAt": { "type": "date" }
    }
  }
}' > /dev/null

# Bulk index data
echo "Bulk indexing sample data..."
curl -s -X POST "$ES_URL/_bulk" \
  -H 'Content-Type: application/x-ndjson' -d '
{"index":{"_index":"posts"}}
{"title":"Getting Started with MongoDB Aggregation Pipelines","content":"Aggregation pipelines are one of Mongodbs most powerful features. Here is how they work with group, match, sort and project stages.","tags":["mongodb","database","tutorial"],"author":"alice_j","likes":342,"reposts":58,"createdAt":"2024-01-20"}
{"index":{"_index":"posts"}}
{"title":"Why Graph Databases are Underrated","content":"When your data is all about relationships, SQL joins become painful. Neo4j changes everything with Cypher queries and graph traversal.","tags":["neo4j","graphdb","dataengineering"],"author":"priya_s","likes":891,"reposts":204,"createdAt":"2024-02-01"}
{"index":{"_index":"posts"}}
{"title":"Redis as a Session Store: Best Practices","content":"Using Redis for sessions is blazing fast. Here are 5 patterns for session storage, caching, pub-sub and rate limiting.","tags":["redis","caching","backend"],"author":"bob_m","likes":567,"reposts":112,"createdAt":"2024-02-10"}
{"index":{"_index":"posts"}}
{"title":"Dark Mode UX: Why Users Love It","content":"Dark mode is not just a trend. Here is the science behind why it reduces eye strain and improves focus for developers and designers.","tags":["ux","design","darkmode"],"author":"emma_w","likes":1204,"reposts":389,"createdAt":"2024-02-15"}
{"index":{"_index":"posts"}}
{"title":"Building REST APIs with Node.js and Express","content":"Step by step guide to building production ready REST APIs with Node.js. Covers authentication, rate limiting, validation and error handling.","tags":["nodejs","api","backend","tutorial"],"author":"carlos_r","likes":733,"reposts":165,"createdAt":"2024-02-20"}
{"index":{"_index":"posts"}}
{"title":"Cassandra Data Modeling: Think in Queries","content":"Unlike relational databases, Cassandra forces you to model around your access patterns. Denormalization is not a bug, it is a feature for performance.","tags":["cassandra","nosql","database"],"author":"alice_j","likes":512,"reposts":95,"createdAt":"2024-02-25"}
{"index":{"_index":"posts"}}
{"title":"InfluxDB Time Series Fundamentals","content":"Time series databases like InfluxDB are optimized for timestamped data. Line protocol format, measurements, tags and fields explained with IoT sensor examples.","tags":["influxdb","timeseries","iot","monitoring"],"author":"priya_s","likes":445,"reposts":88,"createdAt":"2024-02-26"}
' > /dev/null

echo ""
echo "✅ Elasticsearch seed complete!"
echo "--- Verification ---"
curl -s "$ES_URL/posts/_count" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Total documents:', d['count'])"
