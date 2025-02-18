#!/bin/sh
msg="$1"
if [ -z "$msg" ]; then
  echo "Commit message required."
  exit 1
fi

pnpm run build && git add . && git commit -m "$msg" && git push -u origin main