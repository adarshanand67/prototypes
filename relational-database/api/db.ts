import pg from 'pg';
const { Pool } = pg;

// 1. PRIMARY DATABASE - For WRITES
export const poolPrimary = new Pool({
    user: 'adarsh_anand',
    host: 'localhost',
    database: 'adarsh_anand',
    port: 5432,
});

// 2. READ REPLICA - For READS
export const poolReplica = new Pool({
    user: 'adarsh_anand',
    host: 'localhost',
    database: 'adarsh_anand',
    port: 5432, // In real life, this would be a different host/port
});

// 3. SHARDS - Horizontal Scaling Demo
const shard1 = new Pool({
    user: 'adarsh_anand',
    host: 'localhost',
    database: 'adarsh_anand',
    port: 5432,
});

const shard2 = new Pool({
    user: 'adarsh_anand',
    host: 'localhost',
    database: 'adarsh_anand',
    port: 5432,
});

// Shard Routing Logic
export const getShardPool = (userId: number): pg.Pool => {
    return (userId % 2 === 0) ? shard1 : shard2;
};

console.log('🐘 Database Pools Initialized (Simulating Replication & Sharding)');
