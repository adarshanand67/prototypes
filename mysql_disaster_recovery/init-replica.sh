#!/bin/bash
set -e

echo "Master should be ready because of docker depends_on healthy condition."
echo "Setting up replication on the replica..."

mysql -u root -proot <<EOF
CHANGE REPLICATION SOURCE TO 
  SOURCE_HOST='mysql-master',
  SOURCE_USER='root',
  SOURCE_PASSWORD='root',
  SOURCE_AUTO_POSITION=1;
START REPLICA;
EOF

echo "Replication setup complete."
