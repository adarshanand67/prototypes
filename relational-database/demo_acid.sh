#!/bin/bash
echo "========================================================"
echo " ACID PROPERTIES DEMONSTRATION (Atomicity & Durability) "
echo "========================================================"
echo ""
echo "This script attempts to run a single transaction that:"
echo "1. Inserts a new user ('crash_test_dummy')."
echo "2. Inserts a new post for that user."
echo "3. Pauses for 20 seconds."
echo ""
echo "YOUR TASK: While this script is paused, open a new terminal"
echo "and run the following command to forcefully kill the database:"
echo ""
echo "    killall -9 postgres"
echo ""
echo "Starting the transaction in 4 seconds..."
sleep 4

psql -v ON_ERROR_STOP=1 postgres <<EOF
\c social_network;

-- Start the transaction
BEGIN;

SELECT 'Transaction started...' AS status;

INSERT INTO users (username, email) VALUES ('crash_test_dummy', 'crash@example.com');
INSERT INTO posts (user_id, content) VALUES (currval('users_id_seq'), 'Post that should not exist if DB crashes');

SELECT 'Data inserted into memory. Sleeping for 20 seconds. KILL THE DB NOW!' AS status;
SELECT pg_sleep(20);

COMMIT;

SELECT 'Transaction committed successfully. If you see this, you did not kill the DB in time!' AS status;
EOF

echo ""
echo "Script finished (or DB connection was lost because it was killed)."
echo "Run ./verify.sh after restarting the DB to check Atomicity."
