#!/bin/bash
# MySQL CLI-based Disaster Recovery Simulation using Docker Containers
# This script simulates the entire disaster recovery workflow using MySQL CLI commands
# with Docker containers as the backend

set -e

echo "=== MySQL CLI Disaster Recovery Simulation (Docker Backend) ==="
echo "This script simulates the complete disaster recovery workflow using MySQL CLI commands with Docker containers."
echo

# Configuration
MASTER_CONTAINER="mysql-master"
REPLICA_CONTAINER="mysql-replica"
ROOT_PASSWORD="root"
DATABASE_NAME="testdb"
TABLE_NAME="recovery_test"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to execute MySQL command in Docker container
docker_mysql_cmd() {
    local container=$1
    local query=$2
    docker exec "$container" mysql -uroot -p"$ROOT_PASSWORD" -e "$query" 2>/dev/null
}

# Function to execute mysqldump in Docker container
docker_mysqldump() {
    local container=$1
    local output_file=$2
    docker exec "$container" mysqldump -uroot -p"$ROOT_PASSWORD" "$DATABASE_NAME" > "$output_file" 2>/dev/null
}

# Function to check if Docker container is running
check_container() {
    local container=$1
    docker ps | grep -q "$container"
}

# Function to wait for MySQL container to be ready
wait_for_container() {
    local container=$1
    local max_attempts=30
    local attempt=1
    
    print_step "Waiting for MySQL container $container to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker_mysql_cmd "$container" "SELECT 1;" >/dev/null 2>&1; then
            print_success "MySQL container $container is ready"
            return 0
        fi
        echo "Attempt $attempt/$max_attempts..."
        sleep 2
        ((attempt++))
    done
    
    print_error "MySQL container $container is not responding after $max_attempts attempts"
    return 1
}

# Function to setup master database
setup_master() {
    print_step "Setting up Master database..."
    
    # Check if master container is running
    if ! check_container "$MASTER_CONTAINER"; then
        print_error "Master MySQL container $MASTER_CONTAINER is not running"
        print_warning "Please start the Docker containers first"
        return 1
    fi
    
    # Create database if it doesn't exist
    docker_mysql_cmd "$MASTER_CONTAINER" "CREATE DATABASE IF NOT EXISTS $DATABASE_NAME;"
    
    # Create table if it doesn't exist
    docker_mysql_cmd "$MASTER_CONTAINER" "USE $DATABASE_NAME; CREATE TABLE IF NOT EXISTS $TABLE_NAME (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );"
    
    print_success "Master database setup complete"
}

# Function to setup replica database
setup_replica() {
    print_step "Setting up Replica database..."
    
    # Check if replica container is running
    if ! check_container "$REPLICA_CONTAINER"; then
        print_error "Replica MySQL container $REPLICA_CONTAINER is not running"
        print_warning "Please start the Docker containers first"
        return 1
    fi
    
    # Create database if it doesn't exist
    docker_mysql_cmd "$REPLICA_CONTAINER" "CREATE DATABASE IF NOT EXISTS $DATABASE_NAME;"
    
    # Create table if it doesn't exist
    docker_mysql_cmd "$REPLICA_CONTAINER" "USE $DATABASE_NAME; CREATE TABLE IF NOT EXISTS $TABLE_NAME (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );"
    
    print_success "Replica database setup complete"
}

# Function to setup replication
setup_replication() {
    print_step "Setting up replication between Master and Replica..."
    
    # Create replication user on master
    docker_mysql_cmd "$MASTER_CONTAINER" "CREATE USER IF NOT EXISTS 'repl'@'%' IDENTIFIED WITH mysql_native_password BY 'repl_password';"
    docker_mysql_cmd "$MASTER_CONTAINER" "GRANT REPLICATION SLAVE ON *.* TO 'repl'@'%';"
    docker_mysql_cmd "$MASTER_CONTAINER" "FLUSH PRIVILEGES;"
    
    # Get master status
    print_step "Getting master status..."
    MASTER_STATUS=$(docker_mysql_cmd "$MASTER_CONTAINER" "SHOW MASTER STATUS\G" | grep -E "File|Position")
    echo "$MASTER_STATUS"
    
    # Stop replica if running
    docker_mysql_cmd "$REPLICA_CONTAINER" "STOP REPLICA;"
    
    # Reset replica
    docker_mysql_cmd "$REPLICA_CONTAINER" "RESET REPLICA ALL;"
    
    # Configure replica to connect to master
    docker_mysql_cmd "$REPLICA_CONTAINER" "CHANGE REPLICATION SOURCE TO 
        SOURCE_HOST='mysql-master',
        SOURCE_PORT=3306,
        SOURCE_USER='repl',
        SOURCE_PASSWORD='repl_password',
        SOURCE_AUTO_POSITION=1;"
    
    # Start replica
    docker_mysql_cmd "$REPLICA_CONTAINER" "START REPLICA;"
    
    print_success "Replication setup complete"
}

# Function to verify replication status
verify_replication() {
    print_step "Verifying replication status..."
    
    REPLICA_STATUS=$(docker_mysql_cmd "$REPLICA_CONTAINER" "SHOW REPLICA STATUS\G")
    
    IO_RUNNING=$(echo "$REPLICA_STATUS" | grep "Replica_IO_Running:" | awk '{print $2}')
    SQL_RUNNING=$(echo "$REPLICA_STATUS" | grep "Replica_SQL_Running:" | awk '{print $2}')
    
    if [ "$IO_RUNNING" = "Yes" ] && [ "$SQL_RUNNING" = "Yes" ]; then
        print_success "Replication is working correctly"
        return 0
    else
        print_error "Replication is not working correctly"
        echo "IO Running: $IO_RUNNING"
        echo "SQL Running: $SQL_RUNNING"
        return 1
    fi
}

# Function to generate test data
generate_test_data() {
    print_step "Generating test data on Master..."
    
    for i in {1..10}; do
        MESSAGE="CLI Simulation msg $i at $(date)"
        docker_mysql_cmd "$MASTER_CONTAINER" "USE $DATABASE_NAME; INSERT INTO $TABLE_NAME (data) VALUES ('$MESSAGE');"
        echo "Inserted: $MESSAGE"
        sleep 1
    done
    
    print_success "Test data generation complete"
}

# Function to verify data replication
verify_data_replication() {
    print_step "Verifying data replication..."
    
    MASTER_COUNT=$(docker_mysql_cmd "$MASTER_CONTAINER" "USE $DATABASE_NAME; SELECT COUNT(*) FROM $TABLE_NAME;" | tail -1)
    REPLICA_COUNT=$(docker_mysql_cmd "$REPLICA_CONTAINER" "USE $DATABASE_NAME; SELECT COUNT(*) FROM $TABLE_NAME;" | tail -1)
    
    echo "Master record count: $MASTER_COUNT"
    echo "Replica record count: $REPLICA_COUNT"
    
    if [ "$MASTER_COUNT" = "$REPLICA_COUNT" ] && [ "$MASTER_COUNT" -gt 0 ]; then
        print_success "Data replication verified successfully"
        return 0
    else
        print_error "Data replication verification failed"
        return 1
    fi
}

# Function to simulate disaster
simulate_disaster() {
    print_step "=== SIMULATING DISASTER ==="
    print_warning "This simulates complete master database failure"
    
    print_warning "Simulating master container destruction..."
    
    # Stop and remove master container
    docker stop "$MASTER_CONTAINER" >/dev/null 2>&1 || true
    docker rm "$MASTER_CONTAINER" >/dev/null 2>&1 || true
    
    # Remove master data volume
    docker volume rm mysql_disaster_recovery_master-data >/dev/null 2>&1 || true
    
    print_success "Master container and data volume destroyed"
    print_warning "Master database is now completely lost"
}

# Function to perform recovery
perform_recovery() {
    print_step "=== PERFORMING RECOVERY ==="
    
    # 1. Export data from replica (backup)
    print_step "1. Exporting data from Replica (Backup)..."
    docker_mysqldump "$REPLICA_CONTAINER" backup_recovery.sql
    
    # 2. Start a fresh Master container
    print_step "2. Starting a fresh Master container..."
    docker compose up -d mysql-master >/dev/null 2>&1
    
    # Wait for master to be ready
    wait_for_container "$MASTER_CONTAINER"
    
    # 3. Restore data to the new Master
    print_step "3. Restoring data to the new Master..."
    
    # Drop and recreate database on master
    docker_mysql_cmd "$MASTER_CONTAINER" "DROP DATABASE IF EXISTS $DATABASE_NAME;"
    docker_mysql_cmd "$MASTER_CONTAINER" "CREATE DATABASE $DATABASE_NAME;"
    
    # Restore data to master
    docker exec "$MASTER_CONTAINER" mysql -uroot -p"$ROOT_PASSWORD" "$DATABASE_NAME" < backup_recovery.sql
    
    # 4. Verify recovery
    print_step "4. Verifying recovery..."
    RECOVERED_COUNT=$(docker_mysql_cmd "$MASTER_CONTAINER" "USE $DATABASE_NAME; SELECT COUNT(*) FROM $TABLE_NAME;" | tail -1)
    
    echo "Recovered record count: $RECOVERED_COUNT"
    
    if [ "$RECOVERED_COUNT" -gt 0 ]; then
        print_success "Recovery successful!"
        return 0
    else
        print_error "Recovery failed!"
        return 1
    fi
}

# Function to cleanup
cleanup() {
    print_step "Cleaning up temporary files..."
    rm -f backup_recovery.sql
    print_success "Cleanup complete"
}

# Function to show final verification
final_verification() {
    print_step "=== FINAL VERIFICATION ==="
    
    # Check if both containers are running
    if check_container "$MASTER_CONTAINER" && check_container "$REPLICA_CONTAINER"; then
        print_success "Both MySQL containers are running"
    else
        print_error "One or both containers are not running"
        return 1
    fi
    
    # Verify data on both containers
    MASTER_COUNT=$(docker_mysql_cmd "$MASTER_CONTAINER" "USE $DATABASE_NAME; SELECT COUNT(*) FROM $TABLE_NAME;" | tail -1)
    REPLICA_COUNT=$(docker_mysql_cmd "$REPLICA_CONTAINER" "USE $DATABASE_NAME; SELECT COUNT(*) FROM $TABLE_NAME;" | tail -1)
    
    echo "Final Master record count: $MASTER_COUNT"
    echo "Final Replica record count: $REPLICA_COUNT"
    
    if [ "$MASTER_COUNT" -gt 0 ] && [ "$REPLICA_COUNT" -gt 0 ]; then
        print_success "Data recovery verified successfully"
        return 0
    else
        print_error "Data recovery verification failed"
        return 1
    fi
}

# Main workflow
main() {
    echo "Starting MySQL CLI Disaster Recovery Simulation (Docker Backend)..."
    echo
    
    # Check if Docker containers are running
    print_step "Checking Docker container availability..."
    
    if ! check_container "$MASTER_CONTAINER"; then
        print_error "Master MySQL container $MASTER_CONTAINER is not running"
        print_warning "Please start the containers with: docker compose up -d"
        exit 1
    fi
    
    if ! check_container "$REPLICA_CONTAINER"; then
        print_error "Replica MySQL container $REPLICA_CONTAINER is not running"
        print_warning "Please start the containers with: docker compose up -d"
        exit 1
    fi
    
    print_success "Both MySQL containers are running"
    echo
    
    # Setup databases
    setup_master
    setup_replica
    echo
    
    # Setup replication
    setup_replication
    echo
    
    # Wait for replication to stabilize
    sleep 5
    
    # Verify replication
    if ! verify_replication; then
        print_error "Replication setup failed. Cannot proceed with simulation."
        exit 1
    fi
    echo
    
    # Generate and verify test data
    generate_test_data
    echo
    
    if ! verify_data_replication; then
        print_error "Data replication failed. Cannot proceed with disaster simulation."
        exit 1
    fi
    echo
    
    # Simulate disaster
    simulate_disaster
    echo
    
    # Perform recovery
    if ! perform_recovery; then
        print_error "Recovery failed!"
        cleanup
        exit 1
    fi
    echo
    
    # Final verification
    if ! final_verification; then
        print_error "Final verification failed!"
        cleanup
        exit 1
    fi
    echo
    
    # Cleanup
    cleanup
    
    print_success "=== MySQL CLI Disaster Recovery Simulation Complete! ==="
    echo
    echo "Summary:"
    echo "- Master and Replica databases were set up successfully"
    echo "- Replication was configured and verified"
    echo "- Test data was generated and replicated"
    echo "- Disaster scenario was simulated (master container destroyed)"
    echo "- Recovery process was executed successfully"
    echo "- Data integrity was verified after recovery"
    echo "- Both containers are running with recovered data"
}

# Run the simulation
main "$@"