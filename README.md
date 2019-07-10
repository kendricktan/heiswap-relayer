# heiswap-relayer
Heiswap Relayer for gasless withdrawals

# Dependencies
```
sudo apt-get update -y
sudo apt install docker.io -y
sudo systemctl start docker

# So you don't need sudo to run docker
sudo groupadd docker
sudo usermod -aG docker $USER

# Now relogin

sudo curl -L "https://github.com/docker/compose/releases/download/1.23.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

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