#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${REGISTRY:-docker.io/ihsbramn}"
VERSION="${VERSION:-0.2.0-alpha}"
TAG="${TAG:-${VERSION}}"
PLATFORM="${PLATFORM:-linux/amd64,linux/arm64}"

SERVER_IMAGE="${REGISTRY}/openguardrails-server:${TAG}"
CLIENT_IMAGE="${REGISTRY}/openguardrails-client:${TAG}"

echo "============================================"
echo " OpenGuardrails — Docker Image Builder"
echo " Registry: ${REGISTRY}"
echo " Version:  ${VERSION}"
echo " Platform: ${PLATFORM}"
echo "============================================"
echo ""

# Build server
echo "▶ Building server image: ${SERVER_IMAGE} ..."
docker build \
  --platform "${PLATFORM}" \
  --tag "${SERVER_IMAGE}" \
  --tag "${REGISTRY}/openguardrails-server:latest" \
  ./server

# Build client
echo "▶ Building client image: ${CLIENT_IMAGE} ..."
docker build \
  --platform "${PLATFORM}" \
  --tag "${CLIENT_IMAGE}" \
  --tag "${REGISTRY}/openguardrails-client:latest" \
  ./client

echo ""
echo "✓ Images built successfully"

# Push if requested
if [ "${PUSH:-}" = "true" ] || [ "${PUSH:-}" = "1" ]; then
  echo ""
  echo "▶ Pushing images..."
  docker push "${SERVER_IMAGE}"
  docker push "${REGISTRY}/openguardrails-server:latest"
  docker push "${CLIENT_IMAGE}"
  docker push "${REGISTRY}/openguardrails-client:latest"
  echo "✓ Images pushed to ${REGISTRY}"
fi

echo ""
echo "Done."
