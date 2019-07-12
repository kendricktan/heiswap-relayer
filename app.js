/* eslint-disable no-underscore-dangle */
/* eslint-disable no-console */

const Web3 = require('web3');
const HDWalletProvider = require('truffle-hdwallet-provider');
const createDrizzleUtils = require('@drizzle-utils/core');
const heiswapArtifact = require('./contracts/Heiswap.json');

// REST API
const express = require('express');
const cors = require('cors');
const asyncHandler = require('express-async-handler');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;


// Check Environment variables
let hasEnv = true;
if (process.env.INFURA_PROJECT_ID === undefined) {
  hasEnv = false;
  console.log('Missing Env variable: INFURA_PROJECT_ID');
}
if (process.env.ETH_SK === undefined) {
  hasEnv = false;
  console.log('Missing Env variable: ETH_SK');
}
if (hasEnv === false) {
  process.exit(1);
}

// Get web3
const customProvider = new HDWalletProvider(
  [process.env.ETH_SK],
  `https://ropsten.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
);
const web3 = new Web3(customProvider);

// Middlewares
app.use(bodyParser.json());
app.use(cors());

// Relayer logic
app.post('/', asyncHandler(async (req, res) => {
  const postParams = req.body;

  // Extract out post params
  const {
    receiver, ethAmount, ringIdx, c0, keyImage, s
  } = postParams;

  if (
    receiver === undefined
    || ethAmount === undefined
    || ringIdx === undefined
    || c0 === undefined
    || keyImage === undefined
    || s === undefined
  ) {
    res.send({
      errorMessage: 'Invalid payload',
      txHash: null
    });
    res.status(400).end();
    return;
  }

  const accounts = await web3.eth.getAccounts();
  const sender = accounts[0];

  const drizzleUtils = await createDrizzleUtils({ web3 });
  const heiswapInstance = await drizzleUtils.getContractInstance({ artifact: heiswapArtifact });

  let dataBytecode;
  try {
    dataBytecode = heiswapInstance
      .methods
      .withdraw(
        receiver,
        ethAmount,
        ringIdx,
        c0,
        keyImage,
        s
      ).encodeABI();
  } catch (e) {
    res.send({
      errorMessage: 'Payload invalid format',
      txHash: null
    });
    res.status(400).end();
    return;
  }

  let gas;
  try {
    // If estimating the gas throws an error
    // then likely invalid params (i.e. ringIdx is closed or user deposited or keys not valid)
    gas = await web3.eth.estimateGas({
      to: heiswapInstance._address,
      data: dataBytecode
    });
  } catch (e) {
    res.send({
      errorMessage: 'EVM revert on GAS estimation (likely invalid input params).',
      txHash: null
    });
    res.status(400).end();
    return;
  }

  const tx = {
    from: sender,
    to: heiswapInstance._address,
    gas,
    data: dataBytecode,
    nonce: await web3.eth.getTransactionCount(sender)
  };

  // txR has response type of
  /**
   * { blockHash: string,
   *   blockNumber: number,
   *   contractAddress: Maybe string,
   *   cumulativeGasUsed: 1325121,
   *   from: string,
   *   gasUsed: number,
   *   logs: [events],
   *   logsBloom: string,
   *   status: boolean,
   *   to: string,
   *   transactionHash: string,
   *   transactionIndex: number }
   */

  // Try and send transaction
  try {
    const txR = await web3.eth.sendTransaction(tx);
    res.statusCode(200);
    res.send({
      txHash: txR.transactionHash
    });
  } catch (e) {
    const txR = JSON.parse(e.message.split(':').slice(1).join(':'));

    res.statusCode(200);
    res.send({
      errorMessage: e.message.split(':').slice(0, 1),
      txHash: txR.transactionHash
    });
  }
}));

console.log(`Listening on port ${port}`);

app.listen(port, '0.0.0.0');
