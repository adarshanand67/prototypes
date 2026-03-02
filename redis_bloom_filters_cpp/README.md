# Redis Bloom Filter C++ Prototype

This project demonstrates how to interact with Redis Bloom filters using C++ and the `hiredis` client library.

## Project Structure
- `src/main.cpp`: The core C++ program containing logic to reserve, add to, and check elements in a Bloom filter.
- `docs/bloom_filters_guide.md`: A comprehensive explanation of Bloom filters, their mechanics, and real-world use cases.
- `CMakeLists.txt`: Build configuration file.
- `Makefile`: A convenient wrapper for standard build, run, and clean operations.

## Requirements

1. **Redis Stack Server**: You need a running Redis server with the `RedisBloom` module installed. Redis Stack includes this by default.
   - Install using Homebrew:
     ```bash
     brew tap redis-stack/redis-stack
     brew install redis-stack
     redis-stack-server --daemonize yes
     ```
2. **Hiredis**: Minimalistic C client for Redis.
   - Install using Homebrew:
     ```bash
     brew install hiredis
     ```
3. **CMake** & **Make**: For building the project.

## How to Build and Run

You can build and run the application using the provided wrapper `Makefile`.

### Building the project:
```bash
make build
```

### Running the application:
```bash
make run
```
This will automatically build (if necessary) and execute the program connecting to `127.0.0.1:6379`.

### Cleaning the build files:
```bash
make clean
```

## Explanation

The prototype demonstrates:
1. Connecting to Redis seamlessly.
2. Generating a Bloom filter (`user_emails_bf`) using `BF.RESERVE`.
3. Inserting valid items via `BF.ADD`.
4. Testing items that exist (expecting a `1` flag for positive).
5. Testing items that do not exist (expecting a `0` flag for negative).

Read the detailed [guide in docs](./docs/bloom_filters_guide.md) to deeply understand the mathematics and the concept of "False Positives" inherent in this probabilistic data structure.
