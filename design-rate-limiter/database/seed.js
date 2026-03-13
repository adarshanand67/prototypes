import { seedCustomers, getAllCustomers } from './customers.js';

console.log('🌱 Seeding database...');

seedCustomers(100);

const customers = getAllCustomers();
console.log(`\n📊 Sample customers:`);
console.log(JSON.stringify(customers.slice(0, 3), null, 2));

console.log(`\n✅ Seeding complete!`);
console.log(`Total customers: ${customers.length}`);
console.log(`\nUse any API key from above to test rate limiting.`);
console.log(`Example: api_key=${customers[0].apiKey}`);
