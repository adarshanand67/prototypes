#!/bin/bash

echo "Checking data in Replica (Port 3307)..."
docker exec mysql-replica mysql -uroot -proot -D testdb -e "SELECT * FROM recovery_test ORDER BY id DESC LIMIT 5;"
