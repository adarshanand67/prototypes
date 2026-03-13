import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Master Database Pool (for writes)
const masterPool = mysql.createPool({
  host: process.env.MASTER_DB_HOST,
  port: process.env.MASTER_DB_PORT,
  user: process.env.MASTER_DB_USER,
  password: process.env.MASTER_DB_PASSWORD,
  database: process.env.MASTER_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Replica Database Pool (for reads)
const replicaPool = mysql.createPool({
  host: process.env.REPLICA_DB_HOST,
  port: process.env.REPLICA_DB_PORT,
  user: process.env.REPLICA_DB_USER,
  password: process.env.REPLICA_DB_PASSWORD,
  database: process.env.REPLICA_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Track replication lag
const replicationLag = new Map();

// Simulate replication with a delay
async function replicateToSlave(query, params) {
  setTimeout(async () => {
    try {
      await replicaPool.execute(query, params);
      console.log('✅ Replicated to slave:', query.substring(0, 50));
    } catch (error) {
      console.error('❌ Replication error:', error.message);
    }
  }, parseInt(process.env.REPLICATION_LAG) || 2000);
}

export { masterPool, replicaPool, replicateToSlave, replicationLag };
