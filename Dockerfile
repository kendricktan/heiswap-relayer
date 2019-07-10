FROM node:10.16.0-alpine

EXPOSE 3000

RUN apk add --no-cache git make gcc g++ python

COPY . /relayer
WORKDIR /relayer
RUN yarn install --production

RUN apk del make gcc g++ python

ENTRYPOINT ["yarn", "start"]