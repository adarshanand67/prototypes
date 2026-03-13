import fetch from 'node-fetch';
const API_BASE = 'http://localhost:3000/api';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
console.log('\n🎬 E-Commerce Platform Demo - Interactive Flow\n');
console.log('='.repeat(70));
async function demo() {
    try {
        // Demo 1: List all products (cache behavior)
        console.log('\n📋 Demo 1: List All Products (Cache Behavior)');
        console.log('-'.repeat(70));
        console.log('First request (Cache MISS)...');
        let response = await fetch(`${API_BASE}/products`);
        let data = await response.json();
        console.log(`✅ Got ${data.count} products from ${data.source}`);
        console.log(`   Cache Status: ${response.headers.get('x-cache')}`);
        await delay(500);
        console.log('\nSecond request (Cache HIT)...');
        response = await fetch(`${API_BASE}/products`);
        data = await response.json();
        console.log(`✅ Got ${data.count} products from ${data.source}`);
        console.log(`   Cache Status: ${response.headers.get('x-cache')}`);
        // Demo 2: Get specific product
        console.log('\n\n📦 Demo 2: Get Specific Product by ID');
        console.log('-'.repeat(70));
        const productId = 1;
        response = await fetch(`${API_BASE}/products/${productId}`);
        data = await response.json();
        if (data.success) {
            console.log(`✅ Product #${productId}: ${data.data.item_name}`);
            console.log(`   Price: $${data.data.price}`);
            console.log(`   Color: ${data.data.color}`);
            console.log(`   Source: ${data.source}`);
        }
        // Demo 3: Create new product (write to master)
        console.log('\n\n✍️  Demo 3: Create New Product (Write to Master)');
        console.log('-'.repeat(70));
        const newProduct = {
            item_name: 'Demo Product - ' + new Date().toISOString(),
            price: Math.floor(Math.random() * 500) + 50,
            color: 'Demo Blue',
            description: 'This is a demo product created to show replication lag',
            stock_quantity: 100,
            category: 'Electronics'
        };
        console.log('Creating product:', newProduct.item_name);
        response = await fetch(`${API_BASE}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProduct)
        });
        data = await response.json();
        console.log(`✅ Product created with ID: ${data.productId}`);
        console.log(`   Written to: ${data.source}`);
        console.log(`   Replication delay: ${data.replicationDelay}`);
        const createdId = data.productId;
        // Demo 4: Replication Lag Demonstration
        console.log('\n\n⏱️  Demo 4: Replication Lag Demonstration');
        console.log('-'.repeat(70));
        console.log('Immediately reading from REPLICA (before replication)...');
        response = await fetch(`${API_BASE}/products/${createdId}`);
        data = await response.json();
        if (data.success) {
            console.log(`⚠️  Unexpected: Product found in replica immediately`);
        }
        else {
            console.log(`❌ Expected: Product NOT found in replica yet`);
            console.log(`   Error: ${data.error}`);
        }
        await delay(500);
        console.log('\nReading from MASTER...');
        response = await fetch(`${API_BASE}/products/${createdId}/from-master`);
        data = await response.json();
        if (data.success) {
            console.log(`✅ Product found in master: ${data.data.item_name}`);
            console.log(`   Source: ${data.source}`);
        }
        await delay(500);
        console.log('\nComparing MASTER vs REPLICA...');
        response = await fetch(`${API_BASE}/products/${createdId}/compare`);
        data = await response.json();
        console.log(`📊 Master has product: ${data.master ? 'YES ✅' : 'NO ❌'}`);
        console.log(`📊 Replica has product: ${data.replica ? 'YES ✅' : 'NO ❌'}`);
        console.log(`📊 In sync: ${data.inSync ? 'YES ✅' : 'NO ❌'}`);
        console.log(`\n⏳ Waiting 2.5 seconds for replication to complete...`);
        await delay(2500);
        console.log('\nReading from REPLICA (after replication)...');
        response = await fetch(`${API_BASE}/products/${createdId}`);
        data = await response.json();
        if (data.success) {
            console.log(`✅ Product NOW found in replica: ${data.data.item_name}`);
            console.log(`   Source: ${data.source}`);
        }
        console.log('\nComparing MASTER vs REPLICA again...');
        response = await fetch(`${API_BASE}/products/${createdId}/compare`);
        data = await response.json();
        console.log(`📊 Master has product: ${data.master ? 'YES ✅' : 'NO ❌'}`);
        console.log(`📊 Replica has product: ${data.replica ? 'YES ✅' : 'NO ❌'}`);
        console.log(`📊 In sync: ${data.inSync ? 'YES ✅' : 'NO ❌'}`);
        // Demo 5: Update product
        console.log('\n\n✏️  Demo 5: Update Product (Write to Master)');
        console.log('-'.repeat(70));
        const updatedPrice = Math.floor(Math.random() * 500) + 50;
        console.log(`Updating product ${createdId} price to $${updatedPrice}...`);
        response = await fetch(`${API_BASE}/products/${createdId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price: updatedPrice })
        });
        data = await response.json();
        console.log(`✅ Product updated in ${data.source}`);
        console.log(`   Cache cleared: YES`);
        // Demo 6: Cache stats
        console.log('\n\n📊 Demo 6: Cache Statistics');
        console.log('-'.repeat(70));
        response = await fetch(`${API_BASE}/cache/stats`);
        data = await response.json();
        const stats = data.stats;
        console.log(`Keys in cache: ${stats.keys}`);
        console.log(`Cache hits: ${stats.hits}`);
        console.log(`Cache misses: ${stats.misses}`);
        console.log(`Hit rate: ${stats.hits > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) : 0}%`);
        // Demo 7: Health check
        console.log('\n\n❤️  Demo 7: System Health Check');
        console.log('-'.repeat(70));
        response = await fetch('http://localhost:3000/health');
        data = await response.json();
        console.log(`Status: ${data.status}`);
        console.log(`Uptime: ${Math.floor(data.uptime)} seconds`);
        console.log(`Timestamp: ${data.timestamp}`);
        console.log('\n' + '='.repeat(70));
        console.log('✨ Demo completed successfully!\n');
    }
    catch (error) {
        console.error('\n❌ Demo failed:', error.message);
        console.error('Make sure the server is running: npm start\n');
    }
}
// Run the demo
demo();
//# sourceMappingURL=demo.js.map