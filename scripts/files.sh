#!/bin/bash

# Default output is stdout (empty string means stdout in redirection), default pattern is all files
OUTPUT_FILE=""
FILE_PATTERNS=("*")  # Default to all files

# Usage message
usage() {
    echo "Usage: $0 [-o output_file] [-p pattern1 pattern2 ...] [files_or_directories...]"
    echo "  -o: Specify output file (default: stdout)"
    echo "  -p: File patterns to match (default: *)"
    echo "  files_or_directories: Files and/or directories to process (default: current directory)"
    exit 1
}

# Parse command-line options
while getopts "o:p:" opt; do
    case $opt in
        o) OUTPUT_FILE="$OPTARG" ;;
        p) IFS=' ' read -r -a FILE_PATTERNS <<< "$OPTARG" ;;
        ?) usage ;;
    esac
done
shift $((OPTIND - 1))

# If no arguments provided, default to current directory
if [ $# -eq 0 ]; then
    set -- "."
fi

# Build the find command with multiple patterns
FIND_ARGS=()
for pattern in "${FILE_PATTERNS[@]}"; do
    FIND_ARGS+=(-name "$pattern")
    if [ "$pattern" != "${FILE_PATTERNS[-1]}" ]; then
        FIND_ARGS+=(-o)
    fi
done

# Function to process a single path (file or directory)
process_path() {
    local path="$1"
    if [ -f "$path" ]; then
        # If it's a file, process it directly
        echo -e "===== $path =====\n"
        cat "$path"
        echo -e "\n-----\n"
    elif [ -d "$path" ]; then
        # If it's a directory, use find
        find "$path" -type f \( "${FIND_ARGS[@]}" \) -print0 | \
            xargs -0 -I {} /bin/bash -c 'echo -e "===== {} =====\n"; cat "{}"; echo -e "\n-----\n"'
    else
        echo "Warning: Skipping $path - not a file or directory" >&2
    fi
}

# Process all provided paths
if [ -z "$OUTPUT_FILE" ]; then
    # Output to stdout
    for path in "$@"; do
        process_path "$path"
    done
else
    # Output to file
    {
        for path in "$@"; do
            process_path "$path"
        done
    } > "$OUTPUT_FILE"
    echo "Combined files written to $OUTPUT_FILE"
fi