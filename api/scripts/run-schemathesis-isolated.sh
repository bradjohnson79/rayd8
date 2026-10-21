#!/bin/sh
set -eu

case "${1:-}" in
  *onrender.com*|*rayd8.app*|*vercel.app*)
    echo "Refusing Schemathesis against a production host." >&2
    exit 1
    ;;
esac

if [ -n "${STRIPE_SECRET_KEY:-}" ]; then
  echo "Refusing Schemathesis while a Stripe secret is present." >&2
  exit 1
fi

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Refusing Schemathesis while a database URL is present." >&2
  exit 1
fi

export STRIPE_SECRET_KEY=
export STRIPE_WEBHOOK_SECRET=
export DATABASE_URL=
export CLERK_SECRET_KEY=
export CLERK_PUBLISHABLE_KEY=
export CLERK_JWT_KEY=
export OPEN_AI_API_KEY=
export MUX_TOKEN_ID=
export MUX_TOKEN_SECRET=
export MUX_SIGNING_KEY_ID=
export MUX_SIGNING_KEY_PRIVATE=
export PORT=3099
export NODE_ENV=test

cd "$(dirname "$0")/.."
npx tsx src/server.ts > /tmp/rayd8-schemathesis-api.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT

ready=0
i=0
while [ "$i" -lt 40 ]; do
  if curl -sf http://127.0.0.1:3099/health >/dev/null; then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 0.25
done

if [ "$ready" -ne 1 ]; then
  echo "Isolated API did not become ready." >&2
  cat /tmp/rayd8-schemathesis-api.log >&2
  exit 1
fi

schemathesis run openapi/reliability-subset.yaml \
  --url http://127.0.0.1:3099 \
  --workers 1 \
  --max-examples 8 \
  --phases examples,coverage,fuzzing \
  --checks status_code_conformance,content_type_conformance,response_schema_conformance \
  --exclude-checks not_a_server_error,positive_data_acceptance,ignored_auth \
  --suppress-health-check data_too_large \
  --seed 20261021 \
  --report junit,vcr \
  --report-dir /tmp/rayd8-schemathesis-report
