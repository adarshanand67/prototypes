DROP DATABASE IF EXISTS social_network;
CREATE DATABASE social_network;
\c social_network;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE photos (
    id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(id),
    image_url VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE following (
    follower_id INTEGER REFERENCES users(id),
    followee_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followee_id)
);

-- Insert dummy data
INSERT INTO users (username, email) VALUES
    ('alice', 'alice@example.com'),
    ('bob', 'bob@example.com'),
    ('charlie', 'charlie@example.com');

INSERT INTO posts (user_id, content) VALUES
    (1, 'Hello world! This is my first post.'),
    (2, 'I love databases!'),
    (1, 'Another post by alice.');

INSERT INTO photos (post_id, image_url) VALUES
    (1, 'http://example.com/photo1.jpg'),
    (2, 'http://example.com/photo2.jpg');

INSERT INTO following (follower_id, followee_id) VALUES
    (1, 2), -- alice follows bob
    (2, 1), -- bob follows alice
    (3, 1); -- charlie follows alice
