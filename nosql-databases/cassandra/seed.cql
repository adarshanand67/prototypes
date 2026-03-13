-- ============================================================
-- Cassandra Seed Script — Social Network (Wide-Column Store)
-- Run with: cqlsh -f cassandra/seed.cql
-- ============================================================

-- ── Create Keyspace ───────────────────────────────────────────
DROP KEYSPACE IF EXISTS social_network;

CREATE KEYSPACE social_network
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 1
};

USE social_network;

-- ── Users Table ───────────────────────────────────────────────
-- Primary key: user_id (partition key)
CREATE TABLE users (
  user_id    UUID PRIMARY KEY,
  username   TEXT,
  email      TEXT,
  name       TEXT,
  age        INT,
  city       TEXT,
  country    TEXT,
  bio        TEXT,
  followers  INT,
  following  INT,
  verified   BOOLEAN,
  hobbies    SET<TEXT>,
  created_at TIMESTAMP
);

-- ── Posts by User Table (query pattern: get posts by author) ──
-- Partition key: author_id — all posts by one user live together
-- Clustering key: created_at DESC — newest posts first
CREATE TABLE posts_by_user (
  author_id  UUID,
  created_at TIMESTAMP,
  post_id    UUID,
  title      TEXT,
  content    TEXT,
  tags       SET<TEXT>,
  likes      INT,
  reposts    INT,
  PRIMARY KEY (author_id, created_at, post_id)
) WITH CLUSTERING ORDER BY (created_at DESC);

-- ── Posts by Tag (query pattern: get posts with a given tag) ──
CREATE TABLE posts_by_tag (
  tag        TEXT,
  created_at TIMESTAMP,
  post_id    UUID,
  author_id  UUID,
  title      TEXT,
  likes      INT,
  PRIMARY KEY (tag, created_at, post_id)
) WITH CLUSTERING ORDER BY (created_at DESC);

-- ── User Follows (query pattern: who does user X follow?) ─────
CREATE TABLE user_follows (
  follower_id UUID,
  followed_id UUID,
  followed_at TIMESTAMP,
  PRIMARY KEY (follower_id, followed_id)
);

-- ── Followers of user (query pattern: who follows user X?) ────
CREATE TABLE user_followers (
  user_id     UUID,
  follower_id UUID,
  followed_at TIMESTAMP,
  PRIMARY KEY (user_id, follower_id)
);

-- ── Activity Feed (query pattern: get feed for user) ──────────
CREATE TABLE activity_feed (
  user_id    UUID,
  event_time TIMESTAMP,
  event_id   UUID,
  event_type TEXT,   -- 'like', 'comment', 'follow', 'post'
  actor_name TEXT,
  message    TEXT,
  PRIMARY KEY (user_id, event_time, event_id)
) WITH CLUSTERING ORDER BY (event_time DESC);

-- ─────────────────────────────────────────────────────────────
-- INSERT DATA
-- ─────────────────────────────────────────────────────────────

-- Users
INSERT INTO users (user_id, username, email, name, age, city, country, bio, followers, following, verified, hobbies, created_at)
VALUES (11111111-1111-1111-1111-111111111101, 'alice_j', 'alice@example.com', 'Alice Johnson', 28, 'San Francisco', 'USA', 'Coffee addict. Software engineer. Dog mom.', 1240, 320, true, {'photography', 'hiking', 'cooking'}, '2023-01-15T00:00:00Z');

INSERT INTO users (user_id, username, email, name, age, city, country, bio, followers, following, verified, hobbies, created_at)
VALUES (11111111-1111-1111-1111-111111111102, 'bob_m', 'bob@example.com', 'Bob Martinez', 34, 'Austin', 'USA', 'DevOps engineer by day, guitarist by night.', 890, 150, false, {'gaming', 'music', 'cycling'}, '2023-03-10T00:00:00Z');

INSERT INTO users (user_id, username, email, name, age, city, country, bio, followers, following, verified, hobbies, created_at)
VALUES (11111111-1111-1111-1111-111111111103, 'priya_s', 'priya@example.com', 'Priya Sharma', 26, 'Bangalore', 'India', 'ML researcher | Book lover | Always exploring', 4500, 210, true, {'reading', 'yoga', 'travel'}, '2022-11-01T00:00:00Z');

INSERT INTO users (user_id, username, email, name, age, city, country, bio, followers, following, verified, hobbies, created_at)
VALUES (11111111-1111-1111-1111-111111111104, 'carlos_r', 'carlos@example.com', 'Carlos Rivera', 31, 'Mexico City', 'Mexico', 'Full-stack dev. Taco enthusiast.', 2100, 540, false, {'football', 'cooking', 'films'}, '2023-06-20T00:00:00Z');

INSERT INTO users (user_id, username, email, name, age, city, country, bio, followers, following, verified, hobbies, created_at)
VALUES (11111111-1111-1111-1111-111111111105, 'emma_w', 'emma@example.com', 'Emma Wilson', 23, 'London', 'UK', 'UX designer. Making the web beautiful.', 3300, 890, true, {'painting', 'theatre', 'coffee'}, '2023-08-05T00:00:00Z');

-- Posts by User (Alice)
INSERT INTO posts_by_user (author_id, created_at, post_id, title, content, tags, likes, reposts)
VALUES (11111111-1111-1111-1111-111111111101, '2024-01-20T10:00:00Z', uuid(), 'Getting Started with MongoDB Aggregation Pipelines', 'Aggregation pipelines are one of MongoDB most powerful features...', {'mongodb', 'database', 'tutorial'}, 342, 58);

INSERT INTO posts_by_user (author_id, created_at, post_id, title, content, tags, likes, reposts)
VALUES (11111111-1111-1111-1111-111111111101, '2024-02-10T14:00:00Z', uuid(), 'Cassandra Data Modeling: Think in Queries', 'Unlike relational DBs, Cassandra forces you to model around your access patterns...', {'cassandra', 'nosql', 'database'}, 512, 95);

-- Posts by User (Bob)
INSERT INTO posts_by_user (author_id, created_at, post_id, title, content, tags, likes, reposts)
VALUES (11111111-1111-1111-1111-111111111102, '2024-02-10T09:00:00Z', uuid(), 'Redis as a Session Store: Best Practices', 'Using Redis for sessions is blazing fast. Here are 5 patterns I use in production...', {'redis', 'caching', 'backend'}, 567, 112);

-- Posts by User (Priya)
INSERT INTO posts_by_user (author_id, created_at, post_id, title, content, tags, likes, reposts)
VALUES (11111111-1111-1111-1111-111111111103, '2024-02-01T08:00:00Z', uuid(), 'Why Graph Databases are Underrated', 'When your data is all about relationships, SQL joins become painful...', {'neo4j', 'graphdb', 'dataengineering'}, 891, 204);

-- Posts by User (Emma)
INSERT INTO posts_by_user (author_id, created_at, post_id, title, content, tags, likes, reposts)
VALUES (11111111-1111-1111-1111-111111111105, '2024-02-15T16:00:00Z', uuid(), 'Dark Mode UX: Why Users Love It', 'Dark mode is not just a trend. Here is the science behind it...', {'ux', 'design', 'darkmode'}, 1204, 389);

-- Posts by Tag
INSERT INTO posts_by_tag (tag, created_at, post_id, author_id, title, likes)
VALUES ('database', '2024-01-20T10:00:00Z', uuid(), 11111111-1111-1111-1111-111111111101, 'Getting Started with MongoDB Aggregation Pipelines', 342);

INSERT INTO posts_by_tag (tag, created_at, post_id, author_id, title, likes)
VALUES ('nosql', '2024-02-10T14:00:00Z', uuid(), 11111111-1111-1111-1111-111111111101, 'Cassandra Data Modeling: Think in Queries', 512);

INSERT INTO posts_by_tag (tag, created_at, post_id, author_id, title, likes)
VALUES ('backend', '2024-02-10T09:00:00Z', uuid(), 11111111-1111-1111-1111-111111111102, 'Redis as a Session Store: Best Practices', 567);

INSERT INTO posts_by_tag (tag, created_at, post_id, author_id, title, likes)
VALUES ('ux', '2024-02-15T16:00:00Z', uuid(), 11111111-1111-1111-1111-111111111105, 'Dark Mode UX: Why Users Love It', 1204);

-- User Follows
INSERT INTO user_follows (follower_id, followed_id, followed_at) VALUES (11111111-1111-1111-1111-111111111101, 11111111-1111-1111-1111-111111111102, '2023-03-15T00:00:00Z');
INSERT INTO user_follows (follower_id, followed_id, followed_at) VALUES (11111111-1111-1111-1111-111111111101, 11111111-1111-1111-1111-111111111103, '2023-04-01T00:00:00Z');
INSERT INTO user_follows (follower_id, followed_id, followed_at) VALUES (11111111-1111-1111-1111-111111111102, 11111111-1111-1111-1111-111111111101, '2023-05-10T00:00:00Z');
INSERT INTO user_follows (follower_id, followed_id, followed_at) VALUES (11111111-1111-1111-1111-111111111103, 11111111-1111-1111-1111-111111111101, '2023-07-08T00:00:00Z');
INSERT INTO user_follows (follower_id, followed_id, followed_at) VALUES (11111111-1111-1111-1111-111111111105, 11111111-1111-1111-1111-111111111103, '2023-10-05T00:00:00Z');

-- User Followers
INSERT INTO user_followers (user_id, follower_id, followed_at) VALUES (11111111-1111-1111-1111-111111111102, 11111111-1111-1111-1111-111111111101, '2023-03-15T00:00:00Z');
INSERT INTO user_followers (user_id, follower_id, followed_at) VALUES (11111111-1111-1111-1111-111111111103, 11111111-1111-1111-1111-111111111101, '2023-04-01T00:00:00Z');
INSERT INTO user_followers (user_id, follower_id, followed_at) VALUES (11111111-1111-1111-1111-111111111101, 11111111-1111-1111-1111-111111111102, '2023-05-10T00:00:00Z');
INSERT INTO user_followers (user_id, follower_id, followed_at) VALUES (11111111-1111-1111-1111-111111111101, 11111111-1111-1111-1111-111111111103, '2023-07-08T00:00:00Z');
INSERT INTO user_followers (user_id, follower_id, followed_at) VALUES (11111111-1111-1111-1111-111111111103, 11111111-1111-1111-1111-111111111105, '2023-10-05T00:00:00Z');

-- Activity Feed (for Alice)
INSERT INTO activity_feed (user_id, event_time, event_id, event_type, actor_name, message)
VALUES (11111111-1111-1111-1111-111111111101, '2024-02-20T10:00:00Z', uuid(), 'like', 'bob_m', 'bob_m liked your post "MongoDB Aggregation Pipelines"');

INSERT INTO activity_feed (user_id, event_time, event_id, event_type, actor_name, message)
VALUES (11111111-1111-1111-1111-111111111101, '2024-02-19T15:30:00Z', uuid(), 'follow', 'emma_w', 'emma_w started following you');

INSERT INTO activity_feed (user_id, event_time, event_id, event_type, actor_name, message)
VALUES (11111111-1111-1111-1111-111111111101, '2024-02-18T09:00:00Z', uuid(), 'comment', 'priya_s', 'priya_s commented on your post: "This is exactly what I needed!"');

-- ─────────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────────
SELECT '=== USERS ===' AS info;
SELECT username, name, city, followers, verified FROM users;

SELECT '=== ALICE POSTS (newest first) ===' AS info;
SELECT title, likes, created_at FROM posts_by_user WHERE author_id = 11111111-1111-1111-1111-111111111101;

SELECT '=== BACKEND TAG POSTS ===' AS info;
SELECT title, likes FROM posts_by_tag WHERE tag = 'backend';

SELECT '=== ALICE FOLLOWS ===' AS info;
SELECT followed_id, followed_at FROM user_follows WHERE follower_id = 11111111-1111-1111-1111-111111111101;

SELECT '=== ALICE ACTIVITY FEED ===' AS info;
SELECT event_type, actor_name, message, event_time FROM activity_feed 
WHERE user_id = 11111111-1111-1111-1111-111111111101;
