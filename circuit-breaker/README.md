# Circuit Breaker Demo

This project implements a high-level circuit breaker pattern in a microservices architecture, featuring real-time state management using Redis Pub/Sub.

## Architecture

![System Architecture](/Users/adarsh_anand/.gemini/antigravity/brain/f8425b5e-dd7a-47a3-a44a-818d6fc30623/circuit_breaker_architecture_1772470750015.png)

### Circuit Breaker State Machine

![State Machine](/Users/adarsh_anand/.gemini/antigravity/brain/f8425b5e-dd7a-47a3-a44a-818d6fc30623/circuit_breaker_state_machine_retry_1772470799332.png)

### Redis Configuration Flow

![Sequence Diagram](/Users/adarsh_anand/.gemini/antigravity/brain/f8425b5e-dd7a-47a3-a44a-818d6fc30623/redis_config_flow_1772470767320.png)

## Services

1.  **Profile Service (Port 3001)**: The entry point. Calls the Post Service.
2.  **Post Service (Port 3002)**: Intermediate service. Calls the Recommendation Service.
3.  **Recommendation Service (Port 3003)**: Data tier. Can be toggled to fail.
4.  **Circuit Breaker**: A dedicated wrapper used by services to protect downstream calls. It subscribes to Redis for real-time config updates.
5.  **Redis Pub/Sub**: Acts as the real-time configuration store.

## Key Components

- `circuit-breaker.js`: Implements `CLOSED`, `OPEN`, and `HALF_OPEN` states.
- `config-manager.js`: CLI tool to publish state changes to Redis.

## Verification

### Automated Workflows

Run the exhaustive test suite:
```bash
node exhaustive-test.js
```

The test verifies:
| Workflow | Description | Result |
| :--- | :--- | :--- |
| **Normal Flow** | Request flows through all services. | ✅ Passed |
| **Auto-Trip** | Downstream failure causes transition to `OPEN`. | ✅ Passed |
| **Manual Override** | Force `CLOSED` via Redis despite failures. | ✅ Passed |
| **Recovery** | `OPEN` -> `HALF_OPEN` -> `CLOSED` after timeout. | ✅ Passed |
| **Force Open** | Force `OPEN` via Redis to simulate maintenance. | ✅ Passed |

## Usage

1. Start all services (background):
```bash
node service-recommendation.js &
node service-post.js &
node service-profile.js &
```

2. Trigger manual failure:
```bash
curl -X POST http://localhost:3003/toggle-failure
```

3. Manually reset/force state via Redis:
```bash
node config-manager.js post-to-recommendation CLOSED
```
