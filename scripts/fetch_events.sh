#!/bin/bash
set -e  # Exit on error

# Define the target directory
TARGET_DIR="public/data"
mkdir -p "$TARGET_DIR"

# Fetch the JSON data
curl -sS "https://www.rastilippu.fi/api/events/search/?topLeftLat=70.190068&topLeftLon=19.640624&bottomRightLat=59.741636&bottomRightLon=31.769532&dateTimeRangeStart=2025-02-18T00:00:00Z&dateTimeRangeEnd=2025-04-15T00:00:00%2B03:00&size=9999" -o "$TARGET_DIR/events.json"
