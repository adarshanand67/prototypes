import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { masterPool, replicaPool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase(): Promise<void> {
  try {
    console.log('🚀 Initializing database schema...');

    // schema.sql lives in database/ at the project root, two levels up from src/database/
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, '../../database/schema.sql'),
      'utf8'
    );

    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log('📝 Creating schema on MASTER database...');
    for (const statement of statements) {
      await masterPool.execute(statement);
    }
    console.log('✅ Master schema created');

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

if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { initializeDatabase };
