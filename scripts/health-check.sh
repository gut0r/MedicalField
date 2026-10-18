#!/usr/bin/env bash
set -euo pipefail

for target in \
  8001/auth-service \
  8081/patient-service \
  3001/medical-record-service \
  8002/medication-service \
  8082/sync-service \
  3002/document-service; do
  port="${target%%/*}"
  name="${target#*/}"
  curl --fail --silent --show-error "http://127.0.0.1:${port}/internal/health" >/dev/null
  printf '%s: OK\n' "$name"
done
