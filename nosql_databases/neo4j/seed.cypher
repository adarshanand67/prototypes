// ============================================================
// Neo4j Seed Script — Social Graph + Movie Graph
// Run via Neo4j Browser: http://localhost:7474
// Or CLI: cypher-shell -u neo4j -p <password> -f neo4j/seed.cypher
// ============================================================

// Clear everything first
MATCH (n) DETACH DELETE n;

// ── 1. CREATE PERSON NODES ────────────────────────────────────
CREATE (alice:Person {
  id: 1,
  name: 'Alice Johnson',
  username: 'alice_j',
  age: 28,
  city: 'San Francisco',
  occupation: 'Software Engineer',
  verified: true
});

CREATE (bob:Person {
  id: 2,
  name: 'Bob Martinez',
  username: 'bob_m',
  age: 34,
  city: 'Austin',
  occupation: 'DevOps Engineer',
  verified: false
});

CREATE (priya:Person {
  id: 3,
  name: 'Priya Sharma',
  username: 'priya_s',
  age: 26,
  city: 'Bangalore',
  occupation: 'ML Researcher',
  verified: true
});

CREATE (carlos:Person {
  id: 4,
  name: 'Carlos Rivera',
  username: 'carlos_r',
  age: 31,
  city: 'Mexico City',
  occupation: 'Full-Stack Developer',
  verified: false
});

CREATE (emma:Person {
  id: 5,
  name: 'Emma Wilson',
  username: 'emma_w',
  age: 23,
  city: 'London',
  occupation: 'UX Designer',
  verified: true
});

// ── 2. CREATE MOVIE NODES ─────────────────────────────────────
CREATE (inception:Movie {
  id: 101,
  title: 'Inception',
  year: 2010,
  genre: ['Sci-Fi', 'Thriller'],
  rating: 8.8
});

CREATE (matrix:Movie {
  id: 102,
  title: 'The Matrix',
  year: 1999,
  genre: ['Sci-Fi', 'Action'],
  rating: 8.7
});

CREATE (interstellar:Movie {
  id: 103,
  title: 'Interstellar',
  year: 2014,
  genre: ['Sci-Fi', 'Drama'],
  rating: 8.6
});

CREATE (parasite:Movie {
  id: 104,
  title: 'Parasite',
  year: 2019,
  genre: ['Thriller', 'Drama'],
  rating: 8.5
});

CREATE (dune:Movie {
  id: 105,
  title: 'Dune',
  year: 2021,
  genre: ['Sci-Fi', 'Adventure'],
  rating: 8.0
});

// ── 3. PERSON FOLLOWS PERSON ──────────────────────────────────
MATCH (a:Person {username: 'alice_j'}),  (b:Person {username: 'bob_m'})
CREATE (a)-[:FOLLOWS {since: date('2023-03-15')}]->(b);

MATCH (a:Person {username: 'alice_j'}),  (p:Person {username: 'priya_s'})
CREATE (a)-[:FOLLOWS {since: date('2023-04-01')}]->(p);

MATCH (b:Person {username: 'bob_m'}),    (a:Person {username: 'alice_j'})
CREATE (b)-[:FOLLOWS {since: date('2023-05-10')}]->(a);

MATCH (b:Person {username: 'bob_m'}),    (e:Person {username: 'emma_w'})
CREATE (b)-[:FOLLOWS {since: date('2023-06-22')}]->(e);

MATCH (p:Person {username: 'priya_s'}),  (a:Person {username: 'alice_j'})
CREATE (p)-[:FOLLOWS {since: date('2023-07-08')}]->(a);

MATCH (p:Person {username: 'priya_s'}),  (e:Person {username: 'emma_w'})
CREATE (p)-[:FOLLOWS {since: date('2023-08-15')}]->(e);

MATCH (c:Person {username: 'carlos_r'}), (a:Person {username: 'alice_j'})
CREATE (c)-[:FOLLOWS {since: date('2023-09-01')}]->(a);

MATCH (c:Person {username: 'carlos_r'}), (b:Person {username: 'bob_m'})
CREATE (c)-[:FOLLOWS {since: date('2023-09-02')}]->(b);

MATCH (e:Person {username: 'emma_w'}),   (p:Person {username: 'priya_s'})
CREATE (e)-[:FOLLOWS {since: date('2023-10-05')}]->(p);

MATCH (e:Person {username: 'emma_w'}),   (c:Person {username: 'carlos_r'})
CREATE (e)-[:FOLLOWS {since: date('2023-10-06')}]->(c);

// ── 4. PERSON WATCHED/REVIEWED MOVIES ──────────────────────────
MATCH (a:Person {username: 'alice_j'}), (m:Movie {title: 'Inception'})
CREATE (a)-[:REVIEWED {rating: 9, review: 'Mind-bending masterpiece!', date: date('2024-01-10')}]->(m);

MATCH (a:Person {username: 'alice_j'}), (m:Movie {title: 'Interstellar'})
CREATE (a)-[:REVIEWED {rating: 10, review: 'The science is stunning.', date: date('2024-01-20')}]->(m);

MATCH (b:Person {username: 'bob_m'}), (m:Movie {title: 'The Matrix'})
CREATE (b)-[:REVIEWED {rating: 10, review: 'Changed how I see reality.', date: date('2024-01-05')}]->(m);

MATCH (b:Person {username: 'bob_m'}), (m:Movie {title: 'Inception'})
CREATE (b)-[:REVIEWED {rating: 8, review: 'Complex but satisfying.', date: date('2024-01-15')}]->(m);

MATCH (p:Person {username: 'priya_s'}), (m:Movie {title: 'Parasite'})
CREATE (p)-[:REVIEWED {rating: 10, review: 'Pure cinematic genius.', date: date('2024-02-01')}]->(m);

MATCH (p:Person {username: 'priya_s'}), (m:Movie {title: 'Dune'})
CREATE (p)-[:REVIEWED {rating: 9, review: 'Visually spectacular.', date: date('2024-02-10')}]->(m);

MATCH (c:Person {username: 'carlos_r'}), (m:Movie {title: 'Dune'})
CREATE (c)-[:REVIEWED {rating: 8, review: 'Epic world-building.', date: date('2024-01-28')}]->(m);

MATCH (c:Person {username: 'carlos_r'}), (m:Movie {title: 'The Matrix'})
CREATE (c)-[:REVIEWED {rating: 9, review: 'A cultural touchstone.', date: date('2024-02-05')}]->(m);

MATCH (e:Person {username: 'emma_w'}), (m:Movie {title: 'Parasite'})
CREATE (e)-[:REVIEWED {rating: 10, review: 'A masterclass in storytelling.', date: date('2024-02-12')}]->(m);

MATCH (e:Person {username: 'emma_w'}), (m:Movie {title: 'Inception'})
CREATE (e)-[:REVIEWED {rating: 9, review: 'I dream about this movie.', date: date('2024-02-18')}]->(m);

// ── 5. FRIENDS (UNDIRECTED) ───────────────────────────────────
MATCH (a:Person {username: 'alice_j'}), (e:Person {username: 'emma_w'})
CREATE (a)-[:FRIENDS_WITH {since: date('2024-01-01')}]->(e),
       (e)-[:FRIENDS_WITH {since: date('2024-01-01')}]->(a);

MATCH (b:Person {username: 'bob_m'}), (c:Person {username: 'carlos_r'})
CREATE (b)-[:FRIENDS_WITH {since: date('2024-01-15')}]->(c),
       (c)-[:FRIENDS_WITH {since: date('2024-01-15')}]->(b);

// ── VERIFICATION QUERIES ──────────────────────────────────────
// After seeding, try these in Neo4j Browser:

// 1. See the entire graph:
//    MATCH (n) RETURN n LIMIT 50

// 2. Who does Alice follow?
//    MATCH (a:Person {username:'alice_j'})-[:FOLLOWS]->(b) RETURN b.name, b.city

// 3. Friends of friends (2 hops):
//    MATCH (a:Person {username:'alice_j'})-[:FOLLOWS*2]->(fof) 
//    WHERE fof.username <> 'alice_j'
//    RETURN DISTINCT fof.name

// 4. Movies reviewed by people Alice follows:
//    MATCH (a:Person {username:'alice_j'})-[:FOLLOWS]->(friend)-[:REVIEWED]->(m:Movie)
//    RETURN friend.name, m.title, friend.rating

// 5. Top rated movies across all users:
//    MATCH (p:Person)-[r:REVIEWED]->(m:Movie)
//    RETURN m.title, avg(r.rating) AS avg_rating, count(r) AS num_reviews
//    ORDER BY avg_rating DESC

// 6. Shortest path between two users:
//    MATCH path = shortestPath((a:Person {username:'bob_m'})-[*]-(b:Person {username:'priya_s'}))
//    RETURN path

// 7. Movie recommendations (people you follow liked it, you haven't seen it):
//    MATCH (me:Person {username:'alice_j'})-[:FOLLOWS]->(friend)-[:REVIEWED]->(m:Movie)
//    WHERE NOT (me)-[:REVIEWED]->(m)
//    RETURN m.title, count(friend) AS friends_liked, avg(friend.rating) AS avg_friend_rating
//    ORDER BY friends_liked DESC
