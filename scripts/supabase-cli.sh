#!/bin/bash
# Helper script to run Supabase CLI with automatic token authentication
# Usage: ./scripts/supabase-cli.sh [supabase command and args]
# Example: ./scripts/supabase-cli.sh projects list

# Load environment variables from .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | grep SUPABASE_ACCESS_TOKEN | xargs)
fi

# Check if token is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ Error: SUPABASE_ACCESS_TOKEN not found in .env.local"
  exit 1
fi

# Run supabase command with all arguments passed to this script
supabase "$@"
