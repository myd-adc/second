#!/usr/bin/env bash
# Writes .env.local (gitignored) from the running local Supabase stack. Run after `npx supabase start`.
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(npx supabase status -o env | grep -E '^(API_URL|ANON_KEY)=')"
cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
EOF
echo ".env.local written for $API_URL"
