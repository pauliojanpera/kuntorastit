#!/bin/bash
set -e

# Base directory
BASE_DIR="public/kuntorastit"

# Check if build-uuid.txt exists
if [ ! -f "$BASE_DIR/build-uuid.txt" ]; then
  echo "Warning: build-uuid.txt not found in $BASE_DIR. Run 'pnpm run build' first to generate a build UUID."
  echo "Skipping fetch to avoid placing events.json in the wrong directory."
  exit 0  # Exit gracefully, not an error for cron
fi

# Read the buildUuid from build-uuid.txt
BUILD_UUID=$(cat "$BASE_DIR/build-uuid.txt")

# Define the target directory using the buildUuid
TARGET_DIR="$BASE_DIR/$BUILD_UUID/data"
mkdir -p "$TARGET_DIR"

CURRENT_YEAR=$(date +%Y)
START_DATE="${CURRENT_YEAR}-01-01T00:00:00Z"
END_DATE="${CURRENT_YEAR}-12-31T23:59:59Z"

curl -sS "https://www.rastilippu.fi/api/events/search/?topLeftLat=70.190068&topLeftLon=19.640624&bottomRightLat=59.741636&bottomRightLon=31.769532&dateTimeRangeStart=${START_DATE}&dateTimeRangeEnd=${END_DATE}&size=9999" -o "$TARGET_DIR/events.json"

