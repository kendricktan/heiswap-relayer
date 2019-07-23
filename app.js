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

// ECC
const BN = require('bn.js');
const { strTo64BN, bn128 } = require('./utils/AltBn128.js');
const bnZero = new BN('0', 10);


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

  // Debug
  console.log(`Request received: ${JSON.stringify(postParams)}`);

  // Extract out post params
  const {
    message, signedMessage, receiver, ethAmount, ringIdx, c0, keyImage, s
  } = postParams;

  if (
    message === undefined
    || signedMessage === undefined
    || receiver === undefined
    || ethAmount === undefined
    || ringIdx === undefined
    || c0 === undefined
    || keyImage === undefined
    || s === undefined
  ) {
    res
      .status(400)
      .send({
        errorMessage: 'Invalid payload',
        txHash: null
      });
    return;
  }

  const accounts = await web3.eth.getAccounts();
  const sender = accounts[0];

  const drizzleUtils = await createDrizzleUtils({ web3 });
  const heiswapInstance = await drizzleUtils.getContractInstance({ artifact: heiswapArtifact });

  // Make sure sender authorized this tx
  const signatureAddress = await web3.eth.personal.ecRecover(message, signedMessage);

  if (
    signatureAddress.toLowerCase() !== receiver.toLowerCase()
    || message.toLowerCase().indexOf(receiver.toLowerCase()) === -1
  ) {
    res
      .status(400)
      .send({
        errorMessage: 'Invalid Message Signature',
        txHash: null
      });
    return;
  }

  // Verify signature before sending it of to the EVM
  // (saves GAS if invalid tx that way)
  // Checks if ring is closed
  const ringHash = await heiswapInstance
    .methods
    .getRingHash(ethAmount, ringIdx)
    .call();

  const ringHashBuf = Buffer.from(
    ringHash.slice(2), // Remove the '0x'
    'hex'
  );
  const ethAddressBuf = Buffer.from(
    receiver.slice(2), // Remove the '0x'
    'hex'
  );
  const msgBuf = Buffer.concat([
    ringHashBuf,
    ethAddressBuf
  ]);

  const publicKeys = await heiswapInstance
    .methods
    .getPublicKeys(ethAmount, ringIdx)
    .call();

  const publicKeysBN = publicKeys
    .map(x => {
      return [
        // Slice the '0x'
        new BN(Buffer.from(x[0].slice(2), 'hex')),
        new BN(Buffer.from(x[1].slice(2), 'hex'))
      ];
    })
    .filter(x => x[0].cmp(bnZero) !== 0 && x[1].cmp(bnZero) !== 0);

  const ringSignature = [
    strTo64BN(c0),
    s.map(x => strTo64BN(x)),
    [
      strTo64BN(keyImage[0]),
      strTo64BN(keyImage[1])
    ]
  ];

  const validRingSig = bn128.ringVerify(
    msgBuf,
    publicKeysBN,
    ringSignature
  );

  if (!validRingSig) {
    console.log(`Invalid Ring Signature: ${JSON.stringify(postParams)}`);
    res
      .status(400)
      .send({
        errorMessage: 'Invalid Ring Signature',
        txHash: null
      });
    return;
  }

  // Convert to bytecode to estimate GAS
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
    console.log(`Invalid payload: ${JSON.stringify(postParams)}`);
    res
      .status(400)
      .send({
        errorMessage: 'Payload invalid format',
        txHash: null
      });
    return;
  }

  // Passes in-built checks, time to estimate GAS
  let gas;
  try {
    // If estimating the gas throws an error
    // then likely invalid params (i.e. ringIdx is closed or user deposited or keys not valid)
    gas = await web3.eth.estimateGas({
      to: heiswapInstance._address,
      data: dataBytecode
    });
  } catch (e) {
    console.log(`EVM revert: ${JSON.stringify(postParams)}`);
    res.status(400)
      .send({
        errorMessage: 'EVM revert on GAS estimation (likely invalid input params).',
        txHash: null
      });
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
  console.log('Sending tx...');
  try {
    const txR = await web3.eth.sendTransaction(tx);
    res
      .status(200)
      .send({
        txHash: txR.transactionHash
      });
  } catch (e) {
    const txR = JSON.parse(e.message.split(':').slice(1).join(':'));

    res
      .status(200)
      .send({
        errorMessage: e.message.split(':').slice(0, 1),
        txHash: txR.transactionHash
      });
  }
  console.log('Tx sent...');
}));

console.log(`Listening on port ${port}`);

app.listen(port, '0.0.0.0');
