import { faker } from '@faker-js/faker';

export interface Customer {
  id: number;
  name: string;
  email: string;
  apiKey: string;
  tier: 'free' | 'basic' | 'premium';
  createdAt: Date;
}

let customers: Customer[] = [];

export function seedCustomers(count: number = 100): Customer[] {
  customers = [];
  for (let i = 1; i <= count; i++) {
    customers.push({
      id: i,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      apiKey: `api_${faker.string.alphanumeric(32)}`,
      tier: faker.helpers.arrayElement(['free', 'basic', 'premium'] as const),
      createdAt: faker.date.past(),
    });
  }
  console.log(`✅ Seeded ${count} customers`);
  return customers;
}

export function getCustomerByApiKey(apiKey: string): Customer | undefined {
  return customers.find(c => c.apiKey === apiKey);
}

export function getAllCustomers(): Customer[] {
  return customers;
}

export function getCustomerById(id: number | string): Customer | undefined {
  return customers.find(c => c.id === parseInt(String(id)));
}

export { customers };
