import axios from 'axios';
import { execSync } from 'child_process';
const BASE_URL = 'http://localhost:3001';
const RECOMMENDATION_URL = 'http://localhost:3003';
async function test() {
    console.log('--- Phase 1: Normal Flow ---');
    let res = await axios.get(`${BASE_URL}/profile/1`);
    console.log('Profile Response:', JSON.stringify(res.data, null, 2));
    console.log('\n--- Phase 2: Triggering Failure in Recommendation Service ---');
    await axios.post(`${RECOMMENDATION_URL}/toggle-failure`);
    for (let i = 1; i <= 4; i++) {
        console.log(`Request ${i}...`);
        try {
            res = await axios.get(`${BASE_URL}/profile/1`);
            console.log(`Source: ${res.data.source}`);
        }
        catch (e) {
            console.log('Request failed');
        }
    }
    console.log('\n--- Phase 3: Real-time Configuration (Manual CLOSE via Redis) ---');
    execSync('node config-manager.js post-to-recommendation CLOSED', { cwd: process.cwd() });
    await new Promise(r => setTimeout(r, 1000));
    res = await axios.get(`${BASE_URL}/profile/1`);
    console.log('After Redis Override (Source):', res.data.source);
    console.log('\n--- Phase 4: Recovery Flow ---');
    await axios.post(`${RECOMMENDATION_URL}/toggle-failure`); // Turn off failure
    console.log('Failure toggled OFF. Waiting for timeout (6s)...');
    await new Promise(r => setTimeout(r, 6000));
    for (let i = 1; i <= 3; i++) {
        res = await axios.get(`${BASE_URL}/profile/1`);
        console.log(`Recovery Request ${i} Source: ${res.data.source}`);
    }
}
test().catch(console.error);
//# sourceMappingURL=test-circuit-breaker.js.map