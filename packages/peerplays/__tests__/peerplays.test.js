'use strict';
import { assert, expect } from 'chai';
import PPYKeypairService from '../lib/PPYKeypairService';
import { Login } from 'peerplaysjs-lib';

require('isomorphic-fetch');

const peerplays = new (require('../lib/peerplays').default)();
const _PPY = require('../lib/_PPY').default;
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
  },
  prefix: 'PPY'
};

const charlieTester = {
  username: 'miigunner69',
  password: 'QZvbzqGng8BMYzcFW4O5TpqJEwOXmy72O0ceLVwUqeuZ4grRnVmI',
  wifs: {
    owner: '5KYZrFyX3YTMjBYJTrbQcs7DSPvFTa4JqdebpoGckP4SarptipG',
    active: '5JDuvHrcj66Ts5af1NLH3XbdTqepTwbNCJYuLyh1j2QGMztArsS',
    memo: '5KQwCkL561FYfED6LiA6Z3NCvKdAPWPX1AbYVSEPsD3yANTnFjx'
  },
  pubKeys: {
    owner: 'TEST8ThZBscv57ZZtxnDndkkv6gfnbJ8ybabU4YxwfjFMoxSoXwoYA',
    active: 'TEST5cygheeaKf7PodjGcJRXbn4wWhKAYyi7uyVe6uaMtEL4CawKpv',
    memo: 'TEST5LTXoKUtawewrMaqEduF5gAQwbwSS6MbtEKdXYMTjekTq5m3JW'
  },
  prefix: 'TEST'
};

// If using a non mainnet account, provide account data above and change the assignment below.
const TESTING_ACCOUNT = charlieTester; // don't forget to update the endpoint in use in peerplays.js if using a non-mainnet account

// Used for transaction testing
const transactionTest = {
  from: 'init0',
  to: 'init1',
  amount: 1,
  memo: '',
  asset: '1.3.0',
  token: peerplays.defaultToken()
}

// Used for tests requiring a Scatter account object
const dummyAccount = {
  keypairUnique:'thing',
  networkUnique:'ppy:chain:1',
  publicKey: TESTING_ACCOUNT.pubKeys.active,
  name: TESTING_ACCOUNT.username,
  authority: 'active',
  fromOrigin: null,
}

// Used for tests requiring public and private keys
const testingKeys = {
  pubActive: TESTING_ACCOUNT.pubKeys.active,
  privActive: _PPY.privateFromWif(TESTING_ACCOUNT.wifs.active)
}

describe('peerplays', () => {
  it('should convert a private key WIF to it\'s public key (privateToPublic)', async () => {
    const [wif, prefix, publicKey] = [TESTING_ACCOUNT.wifs.active, TESTING_ACCOUNT.prefix, TESTING_ACCOUNT.pubKeys.active]
    assert(peerplays.privateToPublic(wif, prefix) === publicKey, 'Bad public key');
  })

  it('should convert a private key WIF to it\'s PrivateKey counterpart (privateFromWif)', async () => {
    const ppy = peerplays;
    const wif = TESTING_ACCOUNT.wifs.active;
    const pk = _PPY.privateFromWif(wif);
    assert(ppy.privateToPublic(ppy.wifFromPrivate(pk), TESTING_ACCOUNT.prefix) === TESTING_ACCOUNT.pubKeys.active);
  })

  it('should be able to retrieve a Peerplays accounts keys', async () => {
    const username = 'init1';
    assert.typeOf(await _PPY.getAccountKeys(username), 'object');
  });

  it('should be able to retrieve a full Peerplays account', async () => {
    const username = 'init1';
    assert.typeOf(await _PPY.getFullAccount(username), 'object');
  });

  it('should successfully authorize a Peerplays account', async () => {
    assert.equal(await _PPY.authUser(TESTING_ACCOUNT.username, TESTING_ACCOUNT.password), true);
  });

  it('should attempt to register a new Peerplays account', async () => {
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

    const response = await _PPY.register(1, username, password);
    // console.log(response) // to check if the register worked ie: might have hit the ip limit or an account name restricted chars error
    assert.typeOf(response, 'object');
  });

  it('should successfully build a transfer transaction object WITHOUT a memo', async () => {
    const {from, to, token, memo, asset} = transactionTest;
    let {amount} = transactionTest;
    amount = _PPY.convertToChainAmount(amount, token);

    // console.log(`Testing transfer transaction build with: \nfrom: ${from} \nto: ${to} \namount: ${amount} \nmemo: ${memo} \nasset: ${asset}`);
    const tr = await _PPY.getTransferTransaction(from, to, amount, memo ? memo : '', asset);
    assert(tr.operations[0][1].fee.amount > 0);
  });

  it('should successfully build a transfer transaction object WITH a memo', async () => {
    const {from, to, token, asset} = transactionTest;
    let {amount} = transactionTest;
    const memo = 'test memo';
    amount = _PPY.convertToChainAmount(amount, token);

    // console.log(`Testing transfer transaction build with: \nfrom: ${from} \nto: ${to} \namount: ${amount} \nmemo: ${memo} \nasset: ${asset}`);
    let tr = await _PPY.getTransferTransaction(from, to, amount, memo, asset);
    assert(tr.operations[0][1].fee.amount > 0);
  });

  it('should successfully sign a transaction (signer)', async () => {
    const {from, to, token, asset} = transactionTest;
    let {amount} = transactionTest;
    const memo = 'test memo';
    amount = _PPY.convertToChainAmount(amount, token);

    let tr = await _PPY.getTransferTransaction(from, to, amount, memo, asset);
    tr = await peerplays.signer(tr, TESTING_ACCOUNT.pubKeys.active, false, false, _PPY.privateFromWif(TESTING_ACCOUNT.wifs.active));

    assert(tr.signer_private_keys.length > 0);
  });

  it('should successfully finalize a signed transaction (finalize)', async () => {
    const {from, to, token, asset} = transactionTest;
    let {amount} = transactionTest;
    const memo = 'test memo';
    amount = _PPY.convertToChainAmount(amount, token);

    let tr = await _PPY.getTransferTransaction(from, to, amount, memo, asset);
    tr = await peerplays.signer(tr, TESTING_ACCOUNT.pubKeys.active, false, false, _PPY.privateFromWif(TESTING_ACCOUNT.wifs.active));
    await _PPY.finalize(tr);

    // no errors, test passes
  })

  it('should successfully broadcast a signed transaction WITHOUT a memo(transfer)', async () => {
    const {to, token, amount, memo} = transactionTest;
    token.amount = amount;

    return peerplays.transfer({account: dummyAccount, to, amount, memo, token}, testingKeys).then(res => {
      console.log(res);
    }).catch(err => {
      console.error(err);
    });
  });

  it('should successfully broadcast a signed transaction WITH a memo(transfer)', async () => {
    const {to, token, amount} = transactionTest;
    const memo = 'test memo';
    token.amount = amount;

    return peerplays.transfer({account: dummyAccount, to, amount, memo, token}, testingKeys).then(res => {
      console.log(res);
    }).catch(err => {
      console.error(err);
    });
  });

  it('should generate a Keypair instance successfully with a decryptable "master" private key', async () => {
    const {privKeys} = Login.generateKeys(TESTING_ACCOUNT.username, TESTING_ACCOUNT.password, ['owner', 'active', 'memo'], TESTING_ACCOUNT.prefix);
    const wifs = {};

    // Generate WIF for each private key (3 for each authority level).
    for (const [authority, privKey] of Object.entries(privKeys)) {
      wifs[authority] = peerplays.wifFromPrivate(privKey);
    }

    // You can assign other keypair instances to the returned keypair as it is an instance of Scatter KeyPair
    // ie: keypair.blockchains = ['ppy']
    const keypair = PPYKeypairService.newKeypair(wifs, TESTING_ACCOUNT.prefix);
    const decryptedWifs = PPYKeypairService.getWifs(keypair);

    assert(decryptedWifs.owner === TESTING_ACCOUNT.wifs.owner, 'owner key wif decrypt mismatch')
    assert(decryptedWifs.active === TESTING_ACCOUNT.wifs.active, 'active key wif decrypt mismatch')
    assert(decryptedWifs.memo === TESTING_ACCOUNT.wifs.memo, 'memo key wif decrypt mismatch')
  })
});
