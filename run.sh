#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
    echo "ERROR: .env file not found in $(pwd)"
    echo "Copy .env.example to .env and set ANTHROPIC_API_KEY first."
    exit 1
fi

exec /opt/homebrew/bin/python3 server.py "$@"
