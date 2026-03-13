export default class CircuitBreaker {
    constructor(serviceName: any, options?: {});
    initRedis(): Promise<void>;
    call(action: any, fallback: any): Promise<any>;
    onSuccess(result: any): any;
    onFailure(error: any, fallback: any): any;
}
//# sourceMappingURL=circuit-breaker.d.ts.map