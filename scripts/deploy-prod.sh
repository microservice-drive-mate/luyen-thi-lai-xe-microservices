#!/usr/bin/env bash

set -euo pipefail

export DEPLOY_ENV="${DEPLOY_ENV:-production}"

bash "$(dirname "$0")/deploy-compose.sh"
