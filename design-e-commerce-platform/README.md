# E-Commerce Platform - Master-Replica Architecture

Demonstrates master-replica database with 2-second replication lag, caching, and RESTful APIs.

**Stack**: Node.js, Express 5, MySQL 8, Docker, node-cache, Vitest, ES6 modules

## Architecture

```
Client → Express API → Cache (5min TTL)
                    ↓
        ┌──────────┴──────────┐
        ↓                     ↓
    Master (3306)         Replica (3307)
    - Writes              - Reads
        └──→ Replication (2s lag) ──→┘
```

## Quick Start

```bash
docker compose up -d        # Start databases
npm install                 # Install deps
npm run init-db            # Create schema
npm run seed-db            # Seed 400 users + 100 products
npm start                  # Start server at :3000
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/products` | GET | List all (cached, replica) |
| `/api/products/:id` | GET | Get one (cached, replica) |
| `/api/products/:id/from-master` | GET | Get from master |
| `/api/products/:id/compare` | GET | Compare master vs replica |
| `/api/products` | POST | Create (writes to master) |
| `/api/products/:id` | PUT | Update (writes to master) |
| `/api/products/:id` | DELETE | Delete (writes to master) |
| `/health` | GET | Health check |
| `/api/cache/stats` | GET | Cache stats |

## Test Replication Lag

```bash
# Create product (writes to master)
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"item_name":"iPhone","price":999,"color":"Black"}'
# Returns: {"productId": 101, "replicationDelay": "2000ms"}

# Immediately read from replica (FAILS - not replicated yet)
curl http://localhost:3000/api/products/101  # 404

# Read from master (SUCCESS)
curl http://localhost:3000/api/products/101/from-master  # 200 OK

# Wait 2 seconds, read from replica again (SUCCESS)
sleep 2 && curl http://localhost:3000/api/products/101  # 200 OK
```

## Scripts

```bash
npm start                  # Start server
npm test                   # Run API tests (Vitest)
npm run test:watch         # Watch mode
npm run test:ui            # UI mode
npm run demo               # Interactive demo
npm run test-replication   # Test replication lag
npm run generate-diagrams  # Generate PNG diagrams
```

## Database

- **users** (400 records): id, username, email, password_hash, first_name, last_name, phone
- **products** (100 records): id, item_name, price, color, description, stock_quantity, category

## Diagrams

PNG diagrams in [`diagrams/`](diagrams/): architecture, write-flow, read-flow, replication-lag, api-routing

## Cleanup

```bash
docker compose down    # Stop databases
docker compose down -v # Remove volumes
```
