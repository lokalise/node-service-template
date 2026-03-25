#!/usr/bin/env bash
set -euo pipefail

# Configuration
IMAGE_NAME="node-service-template-test"
IMAGE_TAG="healthcheck-test"
CONTAINER_NAME="nst-healthcheck-test"
COMPOSE_PROJECT="nst-docker-test"
HEALTH_URL="http://localhost:3000/health"
MAX_RETRIES=40
RETRY_INTERVAL=2

# Cleanup on exit (success, failure, or signal)
cleanup() {
  echo "Cleaning up..."
  docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  docker compose -p "$COMPOSE_PROJECT" -f docker-compose.yml -f docker-compose.test.yml down --volumes --remove-orphans 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Step 1: Build the Docker image
echo "==> Building Docker image..."
docker build \
  --no-cache \
  --build-arg GIT_COMMIT_SHA="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" \
  --build-arg APP_VERSION="test" \
  -t "${IMAGE_NAME}:${IMAGE_TAG}" \
  .

# Step 2: Start infrastructure dependencies
echo "==> Starting infrastructure dependencies..."
docker compose -p "$COMPOSE_PROJECT" -f docker-compose.yml -f docker-compose.test.yml up -d --quiet-pull --wait

# Step 3: Run the app container on the compose network
NETWORK_NAME="${COMPOSE_PROJECT}_default"

echo "==> Starting application container..."
# Docker --env-file cannot parse multiline values; strip the multiline
# JWT_PUBLIC_KEY block from .env.default (docker-test override supplies a
# single-line version).
FILTERED_ENV=$(mktemp)
awk 'BEGIN{s=0} /^JWT_PUBLIC_KEY=/{s=1} s && /-----END/{s=0;next} s==0' .env.default \
  | sed 's/^\([A-Za-z_][A-Za-z_0-9]*=\)"\(.*\)"$/\1\2/' > "$FILTERED_ENV"

docker run -d \
  --name "$CONTAINER_NAME" \
  --network "$NETWORK_NAME" \
  -p "3000:3000" \
  --env-file "$FILTERED_ENV" \
  --env-file .env.docker-test \
  "${IMAGE_NAME}:${IMAGE_TAG}"
rm -f "$FILTERED_ENV"

# Step 4: Poll healthcheck
echo "==> Polling healthcheck at ${HEALTH_URL}..."
for i in $(seq 1 "$MAX_RETRIES"); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Health check passed on attempt ${i}"
    exit 0
  fi
  echo "  Attempt ${i}/${MAX_RETRIES} - not ready, retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

# Timeout: dump logs and fail
echo "ERROR: Health check failed after $((MAX_RETRIES * RETRY_INTERVAL)) seconds"
echo "=== Application container logs ==="
docker logs "$CONTAINER_NAME" 2>&1 | tail -100
exit 1
