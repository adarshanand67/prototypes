import { LeakyBucket } from '../algorithms/leaky-bucket.js';
import { FixedWindow } from '../algorithms/fixed-window.js';
import { SlidingWindow } from '../algorithms/sliding-window.js';
import redis from '../config/redis.js';

const algorithms = {
  'leaky-bucket': new LeakyBucket(100, 10),
  'fixed-window': new FixedWindow(100, 60),
  'sliding-window': new SlidingWindow(100, 60)
};

async function benchmarkAlgorithm(name, algorithm, requests, burstSize) {
  console.log(`\n🧪 Testing ${name}...`);

  await redis.flushall();

  const results = {
    allowed: 0,
    blocked: 0,
    totalTime: 0,
    avgLatency: 0
  };

  const startTime = Date.now();

  // Simulate burst
  for (let i = 0; i < requests; i++) {
    const reqStart = Date.now();
    const result = await algorithm.isAllowed('test-user');
    const reqEnd = Date.now();

    results.totalTime += (reqEnd - reqStart);

    if (result.allowed) {
      results.allowed++;
    } else {
      results.blocked++;
    }

    // Simulate burst pattern
    if (i > 0 && i % burstSize === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const endTime = Date.now();
  results.avgLatency = results.totalTime / requests;
  results.duration = endTime - startTime;

  return results;
}

async function runBenchmarks() {
  console.log('📊 Rate Limiter Performance Benchmark\n');
  console.log('='.repeat(60));

  const scenarios = [
    { requests: 200, burstSize: 20, name: 'Normal Load' },
    { requests: 500, burstSize: 50, name: 'Heavy Load' },
    { requests: 1000, burstSize: 100, name: 'Burst Pattern' }
  ];

  const allResults = {};

  for (const scenario of scenarios) {
    console.log(`\n\n📈 Scenario: ${scenario.name}`);
    console.log(`   Requests: ${scenario.requests}, Burst Size: ${scenario.burstSize}`);
    console.log('-'.repeat(60));

    allResults[scenario.name] = {};

    for (const [name, algorithm] of Object.entries(algorithms)) {
      const results = await benchmarkAlgorithm(
        name,
        algorithm,
        scenario.requests,
        scenario.burstSize
      );

      allResults[scenario.name][name] = results;

      console.log(`   ✅ Allowed:  ${results.allowed}`);
      console.log(`   ❌ Blocked:  ${results.blocked}`);
      console.log(`   ⚡ Avg Latency: ${results.avgLatency.toFixed(2)}ms`);
      console.log(`   ⏱️  Duration: ${results.duration}ms`);
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 PERFORMANCE SUMMARY');
  console.log('='.repeat(60));

  for (const [scenario, results] of Object.entries(allResults)) {
    console.log(`\n${scenario}:`);
    const sorted = Object.entries(results).sort((a, b) => a[1].avgLatency - b[1].avgLatency);

    sorted.forEach(([name, data], index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
      console.log(`  ${medal} ${name.padEnd(20)} - ${data.avgLatency.toFixed(2)}ms avg latency`);
    });
  }

  console.log('\n\n📈 RECOMMENDATIONS:\n');
  console.log('🔹 Leaky Bucket: Best for smooth, predictable traffic');
  console.log('🔹 Fixed Window: Simplest, good for low-traffic APIs');
  console.log('🔹 Sliding Window: Most accurate, best for high-traffic APIs\n');

  await redis.quit();
  process.exit(0);
}

runBenchmarks().catch(console.error);
