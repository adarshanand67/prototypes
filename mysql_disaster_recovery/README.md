# MySQL Disaster Recovery Simulation

A comprehensive Docker-based simulation demonstrating MySQL disaster recovery scenarios using master-replica replication with GTID (Global Transaction ID) enabled.

## Overview

This project simulates a complete MySQL disaster recovery workflow:

1. **Setup**: Creates a master-replica MySQL cluster with GTID-based replication
2. **Data Generation**: Continuously inserts test data into the master database
3. **Disaster Simulation**: Completely destroys the master database (data loss)
4. **Recovery Process**: Restores data from the replica backup to a new master
5. **Verification**: Confirms data integrity and system functionality

## Architecture

- **Master Database**: MySQL 8.0 on port 3306 with binary logging and GTID enabled
- **Replica Database**: MySQL 8.0 on port 3307 with read-only mode and GTID enabled
- **Data Persistence**: Docker volumes for data storage
- **Health Checks**: Automated health monitoring for container readiness

## Prerequisites

- Docker and Docker Compose installed
- Node.js (for the simulation script)
- MySQL client tools (optional, for manual verification)

## Quick Start

### Option 1: Docker-Based Simulation (Recommended for Testing)

```bash
# Navigate to the project directory
cd mysql_disaster_recovery

# Install Node.js dependencies
npm install

# Start the MySQL master-replica cluster
docker compose up -d

# Wait for containers to be healthy (check with docker ps)
```

### Option 2: MySQL CLI-Based Simulation (For Production-like Testing)

This option simulates the entire workflow using MySQL CLI commands without Docker containers.

**Prerequisites:**
- Two MySQL server instances running (one on port 3306, another on port 3307)
- Root access to both MySQL servers
- MySQL client tools installed

```bash
# Navigate to the project directory
cd mysql_disaster_recovery

# Run the MySQL CLI simulation
./mysql_cli_simulation.sh
```

**MySQL Server Setup for CLI Simulation:**

1. **Start Master MySQL Server (Port 3306):**
   ```bash
   # Start MySQL server on default port 3306
   sudo systemctl start mysql
   # or
   mysqld --port=3306 --datadir=/var/lib/mysql-master
   ```

2. **Start Replica MySQL Server (Port 3307):**
   ```bash
   # Start second MySQL server instance on port 3307
   mysqld --port=3307 --datadir=/var/lib/mysql-replica --socket=/tmp/mysql-replica.sock
   ```

3. **Configure both servers for replication:**
   - Enable binary logging
   - Set unique server IDs
   - Configure GTID if desired

### 2. Verify Initial Setup

```bash
# Check if both containers are running
docker ps

# Verify replication is working
./verify.sh

# Check master status
docker exec mysql-master mysql -uroot -proot -e "SHOW MASTER STATUS\G"

# Check replica status
docker exec mysql-replica mysql -uroot -proot -e "SHOW REPLICA STATUS\G"
```

### 3. Generate Test Data

```bash
# Start data generation (runs indefinitely)
node simulate.js
```

This script will:
- Connect to the master database
- Insert a new record every 2 seconds
- Display confirmation messages for each insertion

### 4. Monitor Data Replication

In a separate terminal, monitor the replica to see data being replicated:

```bash
# Monitor data in replica (every 5 seconds)
watch -n 5 './verify.sh'
```

### 5. Simulate Disaster

**⚠️ WARNING: This will completely destroy the master database**

```bash
# Stop data generation (Ctrl+C in the simulate.js terminal)
# Then simulate disaster
./disaster.sh
```

This script will:
- Kill and remove the master container
- Delete the master's data volume (simulating complete data loss)

### 6. Execute Recovery

```bash
# Start the recovery process
./recover.sh
```

This script will:
- Export data from the replica (backup)
- Start a fresh master container
- Restore data to the new master
- Verify the recovery was successful

### 7. Verify Recovery

```bash
# Check data on the recovered master
docker exec mysql-master mysql -uroot -proot -D testdb -e "SELECT * FROM recovery_test ORDER BY id DESC LIMIT 10;"

# Verify replica is still functional
./verify.sh
```

## Project Structure

```
mysql_disaster_recovery/
├── docker-compose.yml     # Docker configuration for master-replica setup
├── init-master.sql        # Master database initialization script
├── init-replica.sh        # Replica database setup and replication configuration
├── simulate.js           # Node.js script for generating test data
├── disaster.sh           # Script to simulate complete master failure
├── recover.sh            # Script to perform disaster recovery
├── verify.sh             # Script to verify data integrity
├── mysql_cli_simulation.sh # MySQL CLI-based disaster recovery simulation
├── package.json          # Node.js dependencies
└── README.md            # This documentation file
```

## Detailed Workflow

### Phase 1: Initial Setup

1. **Master Container**: Starts with GTID-enabled binary logging
2. **Replica Container**: Starts in read-only mode, waits for master health
3. **Replication Setup**: Automatic configuration via init-replica.sh
4. **Health Monitoring**: Docker health checks ensure proper startup

### Phase 2: Data Generation

The `simulate.js` script:
- Establishes connection to master (port 3306)
- Inserts timestamped messages every 2 seconds
- Provides real-time feedback on insertions
- Demonstrates active write operations

### Phase 3: Disaster Simulation

The `disaster.sh` script:
- Removes master container completely
- Deletes master data volume (simulating hardware failure)
- Leaves replica intact with all data preserved

### Phase 4: Recovery Process

The `recover.sh` script:
1. **Backup Creation**: Exports data from replica using mysqldump
2. **Master Restoration**: Starts fresh master container
3. **Data Restoration**: Imports backup data to new master
4. **Verification**: Confirms data integrity on recovered master

## Key Features

### GTID-Based Replication
- Ensures transaction consistency across master and replica
- Simplifies recovery process by tracking transaction IDs
- Prevents data duplication during recovery

### Automated Health Checks
- Master container health check every 5 seconds
- Replica waits for master before starting replication
- Ensures reliable cluster startup

### Data Persistence
- Docker volumes preserve data across container restarts
- Separate volumes for master and replica data
- Simulates real-world storage scenarios

### Comprehensive Verification
- Pre-disaster data verification
- Post-recovery data integrity checks
- Real-time monitoring capabilities

## Testing the Complete Workflow

To test the entire disaster recovery process:

```bash
# 1. Start fresh (optional: clean up previous runs)
docker compose down -v
rm -f backup_recovery.sql

# 2. Setup cluster
docker compose up -d

# 3. Generate some test data
node simulate.js &
sleep 10  # Generate some data

# 4. Stop data generation
pkill -f simulate.js

# 5. Verify data exists
./verify.sh

# 6. Simulate disaster
./disaster.sh

# 7. Recover from disaster
./recover.sh

# 8. Verify recovery success
docker exec mysql-master mysql -uroot -proot -D testdb -e "SELECT COUNT(*) as total_records FROM recovery_test;"
```

## Troubleshooting

### Common Issues

1. **Containers won't start**
   - Check Docker is running
   - Verify ports 3306 and 3307 are available
   - Check Docker logs: `docker logs mysql-master`

2. **Replication not working**
   - Verify master is healthy before replica starts
   - Check replication status: `SHOW REPLICA STATUS\G`
   - Ensure GTID settings are consistent

3. **Data not appearing in replica**
   - Wait for replication to catch up
   - Check replica IO and SQL threads are running
   - Verify network connectivity between containers

4. **Recovery fails**
   - Ensure replica has all data before disaster
   - Check backup file was created successfully
   - Verify new master is accepting connections

### Useful Commands

```bash
# Check container status
docker ps

# View container logs
docker logs mysql-master
docker logs mysql-replica

# Access MySQL shell
docker exec -it mysql-master mysql -uroot -proot
docker exec -it mysql-replica mysql -uroot -proot

# Check replication status
docker exec mysql-replica mysql -uroot -proot -e "SHOW REPLICA STATUS\G"

# Manual data verification
docker exec mysql-master mysql -uroot -proot -D testdb -e "SELECT * FROM recovery_test;"
```

## Security Considerations

⚠️ **This is a development/testing environment only**

- Uses default root password (`root`)
- No SSL/TLS encryption
- Exposed ports on localhost
- No authentication for replication

For production use:
- Change default passwords
- Enable SSL/TLS
- Use secure replication credentials
- Implement proper network security

## Performance Notes

- Data generation rate: 1 record every 2 seconds
- Replication lag should be minimal in this setup
- Recovery time depends on data volume
- Consider data size when testing with larger datasets

## Extending the Simulation

This framework can be extended to test:

- Different disaster scenarios (partial data loss, network partitions)
- Various recovery strategies (point-in-time recovery, backup restoration)
- Performance under load
- Multiple replica configurations
- Different MySQL versions and configurations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test your changes thoroughly
4. Submit a pull request

## License

This project is for educational and testing purposes. Use at your own risk.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Docker and MySQL logs
3. Verify all prerequisites are met
4. Ensure proper Docker networking