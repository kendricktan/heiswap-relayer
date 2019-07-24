#!/usr/bin/env bash

set -e

cd /home/ubuntu/heiswap-relayer

pwd

docker-compose up --build --scale relayer=2 -d