import { initDatabase } from './database';

async function main() {
  console.log('Initializing database schema...');
  await initDatabase();
  console.log('Database initialized successfully.');
}

main().catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
