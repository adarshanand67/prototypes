const mysql = require('mysql2/promise');

async function main() {
    console.log("Connecting to MySQL Master...");
    const connection = await mysql.createConnection({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'root',
        database: 'testdb'
    });

    console.log("Connected to Master. Inserting data...");

    let count = 0;
    setInterval(async () => {
        count++;
        const message = `Simulation msg ${count} at ${new Date().toISOString()}`;
        try {
            const [result] = await connection.execute(
                'INSERT INTO recovery_test (data) VALUES (?)',
                [message]
            );
            console.log(`[Master] Inserted message: "${message}" (ID: ${result.insertId})`);
        } catch (err) {
            console.error(`[Master] Error inserting message: ${err.message}`);
        }
    }, 2000); // insert every 2 seconds
}

main().catch(console.error);
