#!/bin/bash
set -e  # Exit on error

# Define the target directory
TARGET_DIR="public/kuntorastit/data"
mkdir -p "$TARGET_DIR"

# Get the current year dynamically
CURRENT_YEAR=$(date +%Y)

# Set start and end dates for the full year
START_DATE="${CURRENT_YEAR}-01-01T00:00:00Z"
END_DATE="${CURRENT_YEAR}-12-31T23:59:59Z"

# Fetch the JSON data for the full year
curl -sS "https://www.rastilippu.fi/api/events/search/?topLeftLat=70.190068&topLeftLon=19.640624&bottomRightLat=59.741636&bottomRightLon=31.769532&dateTimeRangeStart=${START_DATE}&dateTimeRangeEnd=${END_DATE}&size=9999" -o "$TARGET_DIR/events.json"