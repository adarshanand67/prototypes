# Elasticsearch Prototype

This prototype demonstrates a **distributed search and analytics engine** using Elasticsearch, featuring full-text search and real-time indexing.

---

## 🏗️ Search Architecture

![Elasticsearch Architecture](/Users/adarsh_anand/.gemini/antigravity/brain/f8425b5e-dd7a-47a3-a44a-818d6fc30623/elasticsearch_architecture_v2_1772471696010.png)

---

## 📄 Indexing and Search

The prototype includes a `seed.sh` script that bulk indexes documents into the `products` index.

### Key Aspects:
- **Inverted Index**: Enables blazing fast full-text searches.
- **RESTful API**: Uses HTTP methods to interact with the cluster.
- **Sharding**: Demonstrates horizontal scaling across multiple nodes.

---

## 🚀 Running the Script

### Prerequisites
- Elasticsearch running locally (port 9200).

### Seeding Data
Use `curl` to run the bulk seed script:

```bash
chmod +x nosql_databases/elasticsearch/seed.sh
./nosql_databases/elasticsearch/seed.sh
```

### Verification
Perform a sample search to find products:

```bash
curl -X GET "localhost:9200/products/_search?q=description:powerful"
```

---

## 🔍 Key Performance Factors
- **Near Real-Time**: Documents are searchable within 1 second of indexing.
- **Schema-on-Write**: JSON documents are indexed with dynamic or explicit mapping.
- **Relevance Scoring**: Uses BM25 algorithm to rank search results.
