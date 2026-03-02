#!/usr/bin/env bash
# ============================================================
# InfluxDB 3 Seed Script — IoT Sensor Data (Homebrew Version)
# Run with: bash influxdb/seed.sh
# ============================================================

URL="http://localhost:8181"
DATABASE="iot_sensors"

echo "📈 InfluxDB 3 Seed — IoT Sensors"
echo "──────────────────────────────────────────"

# Check if InfluxDB is up
until curl -s "$URL/health" > /dev/null; do
  echo "Waiting for InfluxDB at $URL..."
  sleep 5
done

# Create database if it doesn't exist (InfluxDB 3 does this implicitly but good to check)
# Write data using Line Protocol
echo "Writing temperature sensor data..."
curl -s -i -X POST "$URL/api/v2/write?db=$DATABASE&precision=s" \
  --data-raw "
temperature,sensor_id=sensor-01,location=server_room value=24.5 1704067200
temperature,sensor_id=sensor-01,location=server_room value=23.1 1704067500
temperature,sensor_id=sensor-01,location=server_room value=22.8 1704067800
temperature,sensor_id=sensor-01,location=server_room value=22.4 1704068100
temperature,sensor_id=sensor-02,location=office value=21.0 1704068400
" > /dev/null && echo "success"

echo "Writing CPU metrics..."
curl -s -i -X POST "$URL/api/v2/write?db=$DATABASE&precision=s" \
  --data-raw "
cpu_usage,host=db-01,region=us-east user=35.0,idle=51.2 1704067200
cpu_usage,host=db-01,region=us-east user=48.3,idle=38.5 1704067500
cpu_usage,host=db-01,region=us-east user=42.1,idle=45.0 1704067800
" > /dev/null && echo "success"

echo ""
echo "✅ InfluxDB 3 seed complete!"
