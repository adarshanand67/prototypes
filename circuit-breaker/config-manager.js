import { createClient } from 'redis';

async function pushConfig(serviceName, forceState) {
    const client = createClient();
    await client.connect();

    const config = {
        serviceName,
        forceState,
        timestamp: new Date().toISOString()
    };

    await client.publish('circuit-breaker-config', JSON.stringify(config));
    console.log(`Published config: ${JSON.stringify(config)}`);

    await client.quit();
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.log('Usage: node config-manager.js <serviceName|all> <OPEN|CLOSED|HALF_OPEN>');
    process.exit(1);
}

pushConfig(args[0], args[1]);
