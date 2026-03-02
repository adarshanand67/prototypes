-- Create our dummy table
CREATE TABLE IF NOT EXISTS testdb.recovery_test (
    id INT AUTO_INCREMENT PRIMARY KEY,
    data VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);