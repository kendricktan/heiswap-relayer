#!/usr/bin/env bash

set -e
pwd
docker-compose run relayer -f ../docker-compose.yml -e INFURA_PROJECT_ID=$INFURA_PROJECT_ID -e ETH_SK=$ETH_SK --build -d