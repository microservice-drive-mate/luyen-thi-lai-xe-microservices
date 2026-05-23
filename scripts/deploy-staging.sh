#!/usr/bin/env bash

set -euo pipefail

export DEPLOY_ENV="${DEPLOY_ENV:-staging}"

bash "$(dirname "$0")/deploy-compose.sh"
