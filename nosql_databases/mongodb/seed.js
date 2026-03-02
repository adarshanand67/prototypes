// ============================================================
// MongoDB Seed Script — Social Network Database
// Run with: mongosh social_network mongodb/seed.js
// ============================================================

// Switch to our database
use("social_network");

// ── Drop collections to start fresh ──────────────────────────
db.users.drop();
db.posts.drop();
db.comments.drop();

// ── 1. USERS ─────────────────────────────────────────────────
print("Seeding users...");
db.users.insertMany([
    {
        _id: ObjectId("65f0000000000000000001a1"),
        name: "Alice Johnson",
        username: "alice_j",
        email: "alice@example.com",
        age: 28,
        location: { city: "San Francisco", country: "USA" },
        hobbies: ["photography", "hiking", "cooking"],
        bio: "Coffee addict. Software engineer. Dog mom.",
        followers: 1240,
        following: 320,
        verified: true,
        createdAt: new Date("2023-01-15"),
    },
    {
        _id: ObjectId("65f0000000000000000001a2"),
        name: "Bob Martinez",
        username: "bob_m",
        email: "bob@example.com",
        age: 34,
        location: { city: "Austin", country: "USA" },
        hobbies: ["gaming", "music", "cycling"],
        bio: "DevOps engineer by day, guitarist by night.",
        followers: 890,
        following: 150,
        verified: false,
        createdAt: new Date("2023-03-10"),
    },
    {
        _id: ObjectId("65f0000000000000000001a3"),
        name: "Priya Sharma",
        username: "priya_s",
        email: "priya@example.com",
        age: 26,
        location: { city: "Bangalore", country: "India" },
        hobbies: ["reading", "yoga", "travel"],
        bio: "ML researcher | Book lover | Always exploring",
        followers: 4500,
        following: 210,
        verified: true,
        createdAt: new Date("2022-11-01"),
    },
    {
        _id: ObjectId("65f0000000000000000001a4"),
        name: "Carlos Rivera",
        username: "carlos_r",
        email: "carlos@example.com",
        age: 31,
        location: { city: "Mexico City", country: "Mexico" },
        hobbies: ["football", "cooking", "films"],
        bio: "Full-stack dev. Taco enthusiast.",
        followers: 2100,
        following: 540,
        verified: false,
        createdAt: new Date("2023-06-20"),
    },
    {
        _id: ObjectId("65f0000000000000000001a5"),
        name: "Emma Wilson",
        username: "emma_w",
        email: "emma@example.com",
        age: 23,
        location: { city: "London", country: "UK" },
        hobbies: ["painting", "theatre", "coffee"],
        bio: "UX designer. Making the web beautiful.",
        followers: 3300,
        following: 890,
        verified: true,
        createdAt: new Date("2023-08-05"),
    },
]);

// ── 2. POSTS ──────────────────────────────────────────────────
print("Seeding posts...");
db.posts.insertMany([
    {
        _id: ObjectId("65f0000000000000000002b1"),
        authorId: ObjectId("65f0000000000000000001a1"),
        title: "Getting Started with MongoDB Aggregation Pipelines",
        content:
            "Aggregation pipelines are one of MongoDB's most powerful features. Here's how they work...",
        tags: ["mongodb", "database", "tutorial"],
        likes: 342,
        reposts: 58,
        media: [{ type: "image", url: "https://example.com/mongo-diagram.png" }],
        createdAt: new Date("2024-01-20"),
    },
    {
        _id: ObjectId("65f0000000000000000002b2"),
        authorId: ObjectId("65f0000000000000000001a3"),
        title: "Why Graph Databases are Underrated",
        content:
            "When your data is all about relationships, SQL joins become painful. Neo4j changes everything...",
        tags: ["neo4j", "graphdb", "dataengineering"],
        likes: 891,
        reposts: 204,
        media: [],
        createdAt: new Date("2024-02-01"),
    },
    {
        _id: ObjectId("65f0000000000000000002b3"),
        authorId: ObjectId("65f0000000000000000001a2"),
        title: "Redis as a Session Store: Best Practices",
        content:
            "Using Redis for sessions is blazing fast. Here are 5 patterns I use in production...",
        tags: ["redis", "caching", "backend"],
        likes: 567,
        reposts: 112,
        media: [],
        createdAt: new Date("2024-02-10"),
    },
    {
        _id: ObjectId("65f0000000000000000002b4"),
        authorId: ObjectId("65f0000000000000000001a5"),
        title: "Dark Mode UX: Why Users Love It",
        content:
            "Dark mode isn't just a trend. Here's the science behind why it reduces eye strain and improves focus...",
        tags: ["ux", "design", "darkmode"],
        likes: 1204,
        reposts: 389,
        media: [{ type: "image", url: "https://example.com/darkmode.png" }],
        createdAt: new Date("2024-02-15"),
    },
    {
        _id: ObjectId("65f0000000000000000002b5"),
        authorId: ObjectId("65f0000000000000000001a4"),
        title: "Building REST APIs with Node.js + Express",
        content:
            "Step-by-step guide to building production-ready REST APIs. Authentication, rate limiting, validation...",
        tags: ["nodejs", "api", "backend", "tutorial"],
        likes: 733,
        reposts: 165,
        media: [],
        createdAt: new Date("2024-02-20"),
    },
]);

// ── 3. COMMENTS ───────────────────────────────────────────────
print("Seeding comments...");
db.comments.insertMany([
    {
        postId: ObjectId("65f0000000000000000002b1"),
        authorId: ObjectId("65f0000000000000000001a3"),
        text: "This is exactly what I needed! The $group stage explanation is super clear.",
        likes: 24,
        createdAt: new Date("2024-01-21"),
    },
    {
        postId: ObjectId("65f0000000000000000002b1"),
        authorId: ObjectId("65f0000000000000000001a2"),
        text: "Great post! Could you also cover $lookup for joins?",
        likes: 18,
        createdAt: new Date("2024-01-22"),
    },
    {
        postId: ObjectId("65f0000000000000000002b2"),
        authorId: ObjectId("65f0000000000000000001a1"),
        text: "Agreed! Neo4j is a game-changer for social graph analysis.",
        likes: 45,
        createdAt: new Date("2024-02-02"),
    },
    {
        postId: ObjectId("65f0000000000000000002b3"),
        authorId: ObjectId("65f0000000000000000001a4"),
        text: "Do you use Redis Cluster for HA or just sentinel?",
        likes: 12,
        createdAt: new Date("2024-02-11"),
    },
    {
        postId: ObjectId("65f0000000000000000002b4"),
        authorId: ObjectId("65f0000000000000000001a2"),
        text: "The contrast ratio research is fascinating. Sharing this with my team!",
        likes: 67,
        createdAt: new Date("2024-02-16"),
    },
]);

// ── 4. INDEXES ────────────────────────────────────────────────
print("Creating indexes...");
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ "location.city": 1 });
db.posts.createIndex({ authorId: 1 });
db.posts.createIndex({ tags: 1 });
db.posts.createIndex({ createdAt: -1 });
db.comments.createIndex({ postId: 1 });

print("\n✅ Seed complete! Collections created:");
print("  📁 users    → " + db.users.countDocuments() + " documents");
print("  📁 posts    → " + db.posts.countDocuments() + " documents");
print("  📁 comments → " + db.comments.countDocuments() + " documents");
