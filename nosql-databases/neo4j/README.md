# Neo4j Prototype

This prototype demonstrates a **graph database** schema using Neo4j, optimized for relationship-heavy data like social networks.

---

## 🏗️ Graph Schema

![Neo4j Graph Schema](/Users/adarsh_anand/.gemini/antigravity/brain/f8425b5e-dd7a-47a3-a44a-818d6fc30623/neo4j_graph_schema_1772471015012.png)

---

## 📄 Cypher Seed Script

The prototype includes a `seed.cypher` script that creates:
- **(User)** nodes with properties like `name` and `age`.
- **[:FOLLOWS]** relationships between users.
- **[:POSTED]** relationships from users to posts.

---

## 🚀 Running the Script

### Prerequisites
- Neo4j running locally (e.g., via Neo4j Desktop or Docker).

### Seeding Data
You can run the cypher script directly in the Neo4j Browser or using `cypher-shell`:

```bash
cypher-shell -u neo4j -p password -f nosql_databases/neo4j/seed.cypher
```

### Verification
Run the following query in the Neo4j Browser to visualize the graph:

```cypher
MATCH (u:User)-[r]->(m) RETURN u, r, m LIMIT 50;
```

---

## 🔍 Key Concepts Demonstrated
- **Native Graph Storage**: Relationships are first-class citizens.
- **Pattern Matching**: Using Cypher to find friends-of-friends with zero JOIN penalty.
- **Property Graph Model**: Adding metadata to both nodes and relationships.
