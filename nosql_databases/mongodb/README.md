# MongoDB Prototype

This prototype demonstrates a **NoSQL document-oriented database** schema for a social network, featuring high flexibility and nested data structures.

---

## 🏗️ Architecture

![MongoDB Architecture](/Users/adarsh_anand/.gemini/antigravity/brain/f8425b5e-dd7a-47a3-a44a-818d6fc30623/mongodb_architecture_1772470954615.png)

---

## 📄 Schema Design

The database `social_network` consists of three main collections:

### 1. Users
- **Flexibility**: Stores nested objects (e.g., `location`) and arrays (e.g., `hobbies`).
- **Indices**: Unique constraints on `username` and `email`.

### 2. Posts
- **Rich Media**: Includes arrays for `tags` and `media` (images/videos).
- **Embedded Statistics**: Stores `likes` and `reposts` directly on the document for fast reads.

### 3. Comments
- **Reference Pattern**: Stores `authorId` and `postId` as `ObjectId` references.

---

## 🚀 Running the Script

### Prerequisites
- MongoDB installed and running locally.

### Seeding Data
Run the following command to seed the database with sample users, posts, and comments:

```bash
mongosh social_network nosql_databases/mongodb/seed.js
```

### Verification
You can verify the data using `mongosh`:

```javascript
use social_network
db.users.find().pretty()
db.posts.find({ tags: "mongodb" })
```

---

## 🔍 Key Features Demonstrated
- **Schema-less Nature**: Easily add fields like `bio` or `verified` without migrations.
- **Aggregation Support**: Optimized for complex queries via indices on `authorId` and `createdAt`.
- **Fast Writes**: High-performance insertion via `insertMany`.
