import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { masterPool, replicaPool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
  try {
    console.log('🚀 Initializing database schema...');

    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'schema.sql'),
      'utf8'
    );

    // Split by semicolons and filter empty statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Execute on Master
    console.log('📝 Creating schema on MASTER database...');
    for (const statement of statements) {
      await masterPool.execute(statement);
    }
    console.log('✅ Master schema created');

    // Execute on Replica
    console.log('📝 Creating schema on REPLICA database...');
    for (const statement of statements) {
      await replicaPool.execute(statement);
    }
    console.log('✅ Replica schema created');

    console.log('✨ Database initialization completed!');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { initializeDatabase };
