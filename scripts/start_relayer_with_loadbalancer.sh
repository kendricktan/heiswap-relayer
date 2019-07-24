#!/bin/sh
INFURA_PROJECT_ID=$INFURA_PROJECT_ID ETH_SK=$ETH_SK docker-compose up --build --scale relayer=2 -d