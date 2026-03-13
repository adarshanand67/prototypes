import axios from 'axios';

const API_URL = 'http://localhost:3000';

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

interface User {
    id: number;
    username: string;
    email: string;
}

interface ShardResponse {
    shard_routed: number;
    data: { id: number; user_id: number; content: string };
}

interface ShardReadResponse {
    shard_queried: number;
    count: number;
    data: Array<{ id: number; user_id: number; content: string }>;
}

async function runTests(): Promise<void> {
    console.log('\n--- 1. TEST READ REPLICA ROUTING ---');
    try {
        console.log('Sending WRITE request (POST /api/users) -> should hit Primary');
        const writeRes = await axios.post<User>(`${API_URL}/api/users`, {
            username: `testuser_${Date.now()}`,
            email: `test_${Date.now()}@example.com`,
        });
        console.log('Response:', writeRes.data);
        const newUserId = writeRes.data.id;
        console.log('User created with ID:', newUserId);

        console.log('Waiting 1s for logical replication to sync...');
        await sleep(1000);

        console.log('Sending READ request (GET /api/users) -> should hit Replica');
        const readRes = await axios.get<User[]>(`${API_URL}/api/users`);
        const found = readRes.data.find(u => u.id === newUserId);
        if (found) {
            console.log('SUCCESS: User found in replica database read!');
        } else {
            console.error('FAILED: User not found in replica database read.');
        }

        console.log('\n--- 2. TEST DATABASE SHARDING ROUTING ---');
        console.log('Testing User 1 (Should hit Shard 2)');
        const shard2Res = await axios.post<ShardResponse>(`${API_URL}/api/shards/posts`, {
            user_id: 1,
            content: 'This is a post on Shard 2',
        });
        console.log('Response:', shard2Res.data);

        console.log('Testing User 2 (Should hit Shard 1)');
        const shard1Res = await axios.post<ShardResponse>(`${API_URL}/api/shards/posts`, {
            user_id: 2,
            content: 'This is a post on Shard 1',
        });
        console.log('Response:', shard1Res.data);

        console.log('Fetching User 1 Posts (Should read from Shard 2)');
        const getShard2Res = await axios.get<ShardReadResponse>(`${API_URL}/api/shards/posts/1`);
        console.log('Response:', getShard2Res.data);

        console.log('Fetching User 2 Posts (Should read from Shard 1)');
        const getShard1Res = await axios.get<ShardReadResponse>(`${API_URL}/api/shards/posts/2`);
        console.log('Response:', getShard1Res.data);

        console.log('\nAll Scaling and Sharding tests completed!');
    } catch (e) {
        const error = e as { response?: { data: unknown }; message: string };
        console.error('Test error:', error.response ? error.response.data : error.message);
    }
}

runTests();
