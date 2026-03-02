.PHONY: all build clean run check

all: build

build:
	mkdir -p build
	cd build && cmake ..
	cd build && make

run: build
	./build/bloom_filter_demo

clean:
	rm -rf build

check: build
	./build/bloom_filter_demo
