import { createClient } from 'redis';

export default class CircuitBreaker {
    constructor(serviceName, options = {}) {
        this.serviceName = serviceName;
        this.failureThreshold = options.failureThreshold || 3;
        this.successThreshold = options.successThreshold || 2;
        this.timeout = options.timeout || 5000;

        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.forceOpen = false;

        this.initRedis();
    }

    async initRedis() {
        this.client = createClient();
        this.subscriber = this.client.duplicate();

        await this.client.connect();
        await this.subscriber.connect();

        console.log(`[CircuitBreaker:${this.serviceName}] Connected to Redis`);

        await this.subscriber.subscribe('circuit-breaker-config', (message) => {
            const config = JSON.parse(message);
            if (config.serviceName === this.serviceName || config.serviceName === 'all') {
                console.log(`[CircuitBreaker:${this.serviceName}] Received real-time config:`, config);
                if (config.forceState) {
                    this.state = config.forceState;
                    console.log(`[CircuitBreaker:${this.serviceName}] State forced to: ${this.state}`);
                }
                if (config.failureThreshold) this.failureThreshold = config.failureThreshold;
            }
        });
    }

    async call(action, fallback) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
                console.log(`[CircuitBreaker:${this.serviceName}] Transitioned to HALF_OPEN`);
            } else {
                console.log(`[CircuitBreaker:${this.serviceName}] Circuit is OPEN. Returning fallback.`);
                return fallback();
            }
        }

        try {
            const result = await action();
            return this.onSuccess(result);
        } catch (error) {
            return this.onFailure(error, fallback);
        }
    }

    onSuccess(result) {
        this.failureCount = 0;
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.successThreshold) {
                this.state = 'CLOSED';
                this.successCount = 0;
                console.log(`[CircuitBreaker:${this.serviceName}] Transitioned to CLOSED`);
            }
        }
        return result;
    }

    onFailure(error, fallback) {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            console.log(`[CircuitBreaker:${this.serviceName}] Transitioned to OPEN. Last error: ${error.message}`);
        }

        return fallback();
    }
}
