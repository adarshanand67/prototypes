import { faker } from '@faker-js/faker';

// In-memory customer database
let customers = [];

export function seedCustomers(count = 100) {
  customers = [];
  for (let i = 1; i <= count; i++) {
    customers.push({
      id: i,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      apiKey: `api_${faker.string.alphanumeric(32)}`,
      tier: faker.helpers.arrayElement(['free', 'basic', 'premium']),
      createdAt: faker.date.past()
    });
  }
  console.log(`✅ Seeded ${count} customers`);
  return customers;
}

export function getCustomerByApiKey(apiKey) {
  return customers.find(c => c.apiKey === apiKey);
}

export function getAllCustomers() {
  return customers;
}

export function getCustomerById(id) {
  return customers.find(c => c.id === parseInt(id));
}

export { customers };
