cmake_minimum_required(VERSION 3.10)

project(RedisBloomFilterDemo CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find hiredis package (assumed to be installed via homebrew)
find_path(HIREDIS_INCLUDE_DIR hiredis/hiredis.h
    PATHS /opt/homebrew/include /usr/local/include /usr/include
)

find_library(HIREDIS_LIBRARY hiredis
    PATHS /opt/homebrew/lib /usr/local/lib /usr/lib
)

include_directories(${HIREDIS_INCLUDE_DIR})

add_executable(bloom_filter_demo src/main.cpp)
target_link_libraries(bloom_filter_demo ${HIREDIS_LIBRARY})
