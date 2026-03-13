#!/bin/bash
echo "Verifying Atomicity..."
echo "If the transaction was successfully rolled back when you killed the database,"
echo "the following query should return NO rows (0 results)."
echo "-----------------------------------------------------------------"

psql -v ON_ERROR_STOP=1 postgres <<EOF
\c social_network;

SELECT * FROM users WHERE username = 'crash_test_dummy';
EOF

echo "-----------------------------------------------------------------"
echo "If you see NO rows above, Atomicity is proven! The partial transaction was discarded."
