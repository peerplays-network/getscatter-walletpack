'use strict';
import { assert } from 'chai';
import Keypair from '@walletpack/core/models/Keypair';
import { Blockchains } from '@walletpack/core/models/Blockchains';
import { PrivateKey as Pkey } from 'peerplaysjs-lib';
require('isomorphic-fetch');

const peerplays = new (require('../lib/peerplays').default)();
const RandomString = require('randomstring');

// Mainnet testing account
const mainnetTester = {
  username: 'unit39',
  password: 'A4qVtjUa8t6x4mZz7BQoDWWF8Qp6UEFXtrlrBN5BPxWChenbdwKm',
  wifs: {
    owner: '5Hqz4M2KoEfhDML1ty8zhvpvVWqntdAXk86sDrEZBUFaVYYG5T8',
    active: '5KeU4uAV8YT4kZazX4hqakdsPck2L22dZYCHxMFkZL5TsRYex6j',
    memo: '5J7uqJ9TkpJi6ssnbYtqpbdEJXhp2z5KAibuyZg3LUekYJtoeUx'
  },
  pubKeys: {
    owner: 'PPY4yaEWqYHxR8QxrFFFpVwYSgzNaMUVmiNgCwM31WPbjNPDUrKqn',
    active: 'PPY8QGhjBytYZrHpmDorLM4ETsoDYXGbGH3WT8sTrhu3LUJQ9ePf5',
    memo: 'PPY64uMTGiYZQkn5P7dy87fnfVz68b4HYEBRTK1bc3wqEVTcp2GtB'
  }
};

const roles = ['owner','active','memo'];

// account keys for 'unit39'
const KEYPAIR = Keypair.fromJson({
  privateKey: mainnetTester.wifs.active,
  blockchains: [Blockchains.PPY],
  publicKeys: [{
    key: 'PPY8QGhjBytYZrHpmDorLM4ETsoDYXGbGH3WT8sTrhu3LUJQ9ePf5', // active
    blockchain: Blockchains.PPY
  }]
});

describe('peerplays', () => {
  it('should convert a private key WIF to it\'s public key', async () => {
    assert.equal(Pkey.fromWif(mainnetTester.wifs.active).toPublicKey().toPublicKeyString(), mainnetTester.pubKeys.active);
  })

  it('should be able to retrieve a Peerplays accounts keys', async () => {
    const username = 'init1';
    assert.typeOf(await peerplays.getAccountKeys(username), 'object');
  });

  it('should be able to retrieve a Peerplays account', async () => {
    const username = 'init1';
    assert.typeOf(await peerplays.getFullAccount(username), 'object');
  });

  it('should successfully authorize a Peerplays account', async () => {
    assert.equal(await peerplays.authUser(mainnetTester.username, mainnetTester.password), true);
  });

  it.only('should attempt to register a new Peerplays account (ip limit)', async () => {
    const username = RandomString.generate({
      length: 7,
      charset: 'hex',
    });

    const password = RandomString.generate({
      length: 52,
      charset: 'alphanumeric',
    });

    // console.log(
    //   `Testing registration with following data: \nusername: ${username} \npassword: ${password}`
    // );

    const response = await peerplays.register(1, username, password);
    // console.log(response) // to check if the register worked ie: might have hit the ip limit or an account name restricted chars error
    assert.typeOf(response, 'object');
  });

  it('should successfully build a transfer transaction object with no memo', async () => {
    const from = 'init0';
    const to = 'init1';
    const amount = 10000;
    const memo = '';
    const asset = '1.3.0';

    // console.log(`Testing transfer transaction build with: \nfrom: ${from} \nto: ${to} \namount: ${amount} \nmemo: ${memo} \nasset: ${asset}`);
    const transaction = await peerplays.getTransferTransaction(from, to, amount, memo, asset);
    assert(transaction.fee.amount > 0);
  });

  it('should successfully build a transfer transaction object with a memo', async () => {
    const from = 'init0';
    const to = 'init1';
    const amount = 10000;
    const memo = 'test memo';
    const asset = '1.3.0';

    // console.log(`Testing transfer transaction build with: \nfrom: ${from} \nto: ${to} \namount: ${amount} \nmemo: ${memo} \nasset: ${asset}`);
    const transaction = await peerplays.getTransferTransaction(from, to, amount, memo, asset);
    assert(transaction.fee.amount > 0);
  });
});
