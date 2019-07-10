# heiswap-relayer
Heiswap Relayer for gasless withdrawals

# Running the relayer
Make a file called `heiswap.env` in the root folder and make sure it follows the following structure:
```
INFURA_PROJECT_ID=<project id>
ETH_SK=<private key>
```

## Load balancer + multiple relayers
```bash
# Change  relayer=2 to how many instances you want to run
docker-compose up --build --scale relayer=2
```

## Single relayer
```
docker build -t heiswap-relayer .
docker run -e INFURA_PROJECT_ID=<> -e ETH_SK=<> heiswap-relayer
```