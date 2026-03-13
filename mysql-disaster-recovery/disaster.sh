#!/bin/bash
set -e

echo "=== SIMULATING DISASTER ==="
echo "Killing and removing MySQL Master container..."
docker rm -f mysql-master

echo "Removing Master's data volume to simulate complete data loss..."
docker volume rm mysql_disaster_recovery_master-data

echo "Master has been completely destroyed."
