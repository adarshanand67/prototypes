import { faker } from '@faker-js/faker';
import { masterPool, replicaPool } from '../config/database.js';

interface UserSeed {
  username: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string;
}

interface ProductSeed {
  item_name: string;
  price: number;
  color: string;
  description: string;
  stock_quantity: number;
  category: string;
}

function generateUsers(count: number = 400): UserSeed[] {
  const users: UserSeed[] = [];
  for (let i = 0; i < count; i++) {
    users.push({
      username: faker.internet.username(),
      email: faker.internet.email(),
      password_hash: faker.internet.password({ length: 64 }),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      phone: faker.phone.number(),
    });
  }
  return users;
}

function generateProducts(count: number = 100): ProductSeed[] {
  const products: ProductSeed[] = [];
  const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books', 'Toys', 'Food', 'Beauty'];
  const colors = ['Red', 'Blue', 'Green', 'Black', 'White', 'Yellow', 'Purple', 'Orange', 'Pink', 'Brown'];

  for (let i = 0; i < count; i++) {
    products.push({
      item_name: faker.commerce.productName(),
      price: parseFloat(faker.commerce.price({ min: 10, max: 1000 })),
      color: faker.helpers.arrayElement(colors),
      description: faker.commerce.productDescription(),
      stock_quantity: faker.number.int({ min: 0, max: 500 }),
      category: faker.helpers.arrayElement(categories),
    });
  }
  return products;
}

async function seedDatabase(): Promise<void> {
  try {
    console.log('🌱 Starting database seeding...');

    console.log('👥 Seeding users...');
    const users = generateUsers(400);

    for (const user of users) {
      try {
        const query = `INSERT INTO users (username, email, password_hash, first_name, last_name, phone)
                       VALUES (?, ?, ?, ?, ?, ?)`;
        const values = [user.username, user.email, user.password_hash, user.first_name, user.last_name, user.phone];

        await masterPool.execute(query, values);
        await replicaPool.execute(query, values);
      } catch (error) {
        if ((error as { code?: string }).code !== 'ER_DUP_ENTRY') {
          console.error('Error seeding user:', (error as Error).message);
        }
      }
    }
    console.log('✅ Seeded 400 users');

    console.log('📦 Seeding products...');
    const products = generateProducts(100);

    for (const product of products) {
      const query = `INSERT INTO products (item_name, price, color, description, stock_quantity, category)
                     VALUES (?, ?, ?, ?, ?, ?)`;
      const values = [product.item_name, product.price, product.color, product.description, product.stock_quantity, product.category];

      await masterPool.execute(query, values);
      await replicaPool.execute(query, values);
    }
    console.log('✅ Seeded 100 products');

    console.log('✨ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedDatabase };
