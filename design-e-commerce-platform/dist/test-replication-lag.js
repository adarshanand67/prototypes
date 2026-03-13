import fetch from 'node-fetch';
const API_BASE = 'http://localhost:3000/api';
async function testReplicationLag() {
    console.log('🧪 Testing Replication Lag Scenario\n');
    console.log('='.repeat(60));
    try {
        // Step 1: Create a new product (writes to master)
        console.log('\n📝 Step 1: Creating a new product on MASTER...');
        const newProduct = {
            item_name: 'Test Product - Replication Demo',
            price: 99.99,
            color: 'Blue',
            description: 'This product demonstrates replication lag',
            stock_quantity: 50,
            category: 'Electronics'
        };
        const createResponse = await fetch(`${API_BASE}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProduct)
        });
        const created = await createResponse.json();
        console.log('✅ Product created:', created);
        const productId = created.productId;
        // Step 2: Immediately read from replica (should not have it yet)
        console.log('\n📖 Step 2: Immediately reading from REPLICA (before replication)...');
        const replicaResponse = await fetch(`${API_BASE}/products/${productId}`);
        const replicaData = await replicaResponse.json();
        if (replicaData.success) {
            console.log('⚠️  Product found in replica:', replicaData.data);
        }
        else {
            console.log('❌ Product NOT found in replica (as expected):', replicaData.error);
        }
        // Step 3: Read from master (should have it)
        console.log('\n📖 Step 3: Reading from MASTER...');
        const masterResponse = await fetch(`${API_BASE}/products/${productId}/from-master`);
        const masterData = await masterResponse.json();
        console.log('✅ Product found in master:', masterData.data);
        // Step 4: Compare master and replica
        console.log('\n🔍 Step 4: Comparing MASTER vs REPLICA...');
        const compareResponse = await fetch(`${API_BASE}/products/${productId}/compare`);
        const comparison = await compareResponse.json();
        console.log('Comparison result:', comparison);
        // Step 5: Wait for replication to complete
        console.log(`\n⏳ Step 5: Waiting ${created.replicationDelay} for replication to complete...`);
        await new Promise(resolve => setTimeout(resolve, parseInt(process.env.REPLICATION_LAG) || 2000));
        // Step 6: Read from replica again (should have it now)
        console.log('\n📖 Step 6: Reading from REPLICA (after replication)...');
        const replicaResponse2 = await fetch(`${API_BASE}/products/${productId}`);
        const replicaData2 = await replicaResponse2.json();
        if (replicaData2.success) {
            console.log('✅ Product NOW found in replica:', replicaData2.data);
        }
        else {
            console.log('❌ Product still not in replica:', replicaData2.error);
        }
        // Step 7: Compare again
        console.log('\n🔍 Step 7: Comparing MASTER vs REPLICA (after replication)...');
        const compareResponse2 = await fetch(`${API_BASE}/products/${productId}/compare`);
        const comparison2 = await compareResponse2.json();
        console.log('Comparison result:', comparison2);
        console.log('\n' + '='.repeat(60));
        console.log('✨ Replication lag test completed!');
    }
    catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}
// Run the test
testReplicationLag();
//# sourceMappingURL=test-replication-lag.js.map