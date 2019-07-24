#!/usr/bin/env bash

set -e

cd /home/ubuntu/heiswap-relayer

pwd

docker-compose run relayer -e INFURA_PROJECT_ID=$INFURA_PROJECT_ID -e ETH_SK=$ETH_SK --build -d