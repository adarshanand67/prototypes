#include <iostream>
#include <hiredis/hiredis.h>
#include <string>
#include <vector>
#include <cassert>

using namespace std;

// Helper function to check command success
void executeCommandAndCheck(redisContext* c, const string& cmd, bool expectInteger = false) {
    redisReply* reply = (redisReply*)redisCommand(c, cmd.c_str());
    if (reply == nullptr) {
        cerr << "Error: " << c->errstr << endl;
        exit(1);
    }
    
    if (reply->type == REDIS_REPLY_ERROR) {
        cerr << "Command Error (" << cmd << "): " << reply->str << endl;
    } else {
        cout << "Success (" << cmd << "): ";
        if (reply->type == REDIS_REPLY_STATUS) cout << reply->str;
        else if (reply->type == REDIS_REPLY_STRING) cout << reply->str;
        else if (reply->type == REDIS_REPLY_INTEGER) cout << reply->integer;
        else if (reply->type == REDIS_REPLY_ARRAY) cout << "Array of size " << reply->elements;
        else cout << "Unknown reply type " << reply->type;
        cout << endl;
    }
    freeReplyObject(reply);
}

int checkExists(redisContext* c, const string& key, const string& item) {
    string cmd = "BF.EXISTS " + key + " " + item;
    redisReply* reply = (redisReply*)redisCommand(c, cmd.c_str());
    if (reply == nullptr) {
        cerr << "Error executing BF.EXISTS: " << c->errstr << endl;
        exit(1);
    }
    
    int result = -1;
    if (reply->type == REDIS_REPLY_INTEGER) {
        result = reply->integer;
    } else if (reply->type == REDIS_REPLY_ERROR) {
        cerr << "Command Error (" << cmd << "): " << reply->str << endl;
    }
    freeReplyObject(reply);
    return result;
}

int main() {
    cout << "=== Redis Bloom Filter C++ Prototype ===" << endl;

    // Connect to Redis
    redisContext *c = redisConnect("127.0.0.1", 6379);
    if (c == nullptr || c->err) {
        if (c) {
            cerr << "Connection error: " << c->errstr << endl;
            redisFree(c);
        } else {
            cerr << "Connection error: can't allocate redis context" << endl;
        }
        return 1;
    }
    cout << "Successfully connected to Redis at 127.0.0.1:6379" << endl;

    string bf_key = "user_emails_bf";

    // Clean up if it exists
    cout << "\nCleaning up old filter..." << endl;
    redisReply* reply = (redisReply*)redisCommand(c, "DEL %s", bf_key.c_str());
    freeReplyObject(reply);

    // 1. Reserve the Bloom Filter manually
    // syntax: BF.RESERVE {key} {error_rate} {capacity}
    cout << "\n1. Reserving Bloom Filter..." << endl;
    executeCommandAndCheck(c, "BF.RESERVE " + bf_key + " 0.01 1000"); // 1% error rate, 1000 items

    // 2. Add some items
    cout << "\n2. Adding items to Bloom Filter..." << endl;
    vector<string> items_to_add = {"alice@example.com", "bob@example.com", "charlie@example.com"};
    for (const auto& item : items_to_add) {
        executeCommandAndCheck(c, "BF.ADD " + bf_key + " " + item);
    }

    // 3. Check for items that ARE present
    cout << "\n3. Checking items that were ADDED (Should return 1)..." << endl;
    for (const auto& item : items_to_add) {
        int exists = checkExists(c, bf_key, item);
        cout << "BF.EXISTS " << bf_key << " " << item << " -> " << exists;
        if (exists == 1) cout << " (Correct: Found)" << endl;
        else cout << " (Incorrect: Not Found - False Negative! Should never happen)" << endl;
    }

    // 4. Check for items that are NOT present
    cout << "\n4. Checking items that were NEVER ADDED (Should return 0, rarely 1 for false positive)..." << endl;
    vector<string> items_to_check = {"david@example.com", "eve@example.com", "frank@example.com"};
    for (const auto& item : items_to_check) {
        int exists = checkExists(c, bf_key, item);
        cout << "BF.EXISTS " << bf_key << " " << item << " -> " << exists;
        if (exists == 0) cout << " (Correct: Not Found)" << endl;
        else cout << " (False Positive: Bloom filters can occasionally do this!)" << endl;
    }

    redisFree(c);
    cout << "\n=== Prototype Finished ===" << endl;
    return 0;
}
