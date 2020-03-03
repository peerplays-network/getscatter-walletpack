'use strict';
import Account from '../../core/lib/models/Account';
import { Blockchains } from '../../core/lib/models/Blockchains';
import EventService from '../../core/lib/services/utility/EventService';
import KeyPairService from '../../core/lib/services/secure/KeyPairService';
import PluginRepository from '../../core/lib/plugins/PluginRepository';
import SigningService from '../../core/lib/services/secure/SigningService';
import StoreService from '../../core/lib/services/utility/StoreService';

import { assert } from 'chai';
import PPYKeypairService from '../lib/PPYKeypairService';
import _PPY from '../lib/_PPY';
import { Login } from 'peerplaysjs-lib';

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
    memo: '5J7uqJ9TkpJi6ssnbYtqpbdEJXhp2z5KAibuyZg3LUekYJtoeUx',
  },
  pubKeys: {
    owner: 'PPY4yaEWqYHxR8QxrFFFpVwYSgzNaMUVmiNgCwM31WPbjNPDUrKqn',
    active: 'PPY8QGhjBytYZrHpmDorLM4ETsoDYXGbGH3WT8sTrhu3LUJQ9ePf5',
    memo: 'PPY64uMTGiYZQkn5P7dy87fnfVz68b4HYEBRTK1bc3wqEVTcp2GtB',
  },
  prefix: 'PPY',
};

const charlieTester = {
  username: 'miigunner69',
  password: 'QZvbzqGng8BMYzcFW4O5TpqJEwOXmy72O0ceLVwUqeuZ4grRnVmI',
  wifs: {
    owner: '5KYZrFyX3YTMjBYJTrbQcs7DSPvFTa4JqdebpoGckP4SarptipG',
    active: '5JDuvHrcj66Ts5af1NLH3XbdTqepTwbNCJYuLyh1j2QGMztArsS',
    memo: '5KQwCkL561FYfED6LiA6Z3NCvKdAPWPX1AbYVSEPsD3yANTnFjx',
  },
  pubKeys: {
    owner: 'TEST8ThZBscv57ZZtxnDndkkv6gfnbJ8ybabU4YxwfjFMoxSoXwoYA',
    active: 'TEST5cygheeaKf7PodjGcJRXbn4wWhKAYyi7uyVe6uaMtEL4CawKpv',
    memo: 'TEST5LTXoKUtawewrMaqEduF5gAQwbwSS6MbtEKdXYMTjekTq5m3JW',
  },
  prefix: 'TEST',
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
  token: peerplays.defaultToken(),
};

const network = peerplays.getEndorsedNetwork();
const KEYPAIR = PPYKeypairService.newKeypair(TESTING_ACCOUNT.wifs, TESTING_ACCOUNT.prefix);
KEYPAIR.network = peerplays.getEndorsedNetwork;

// Overriding signer to include private key getter.
SigningService.init(async (network, publicKey, payload, arbitrary = false, isHash = false) => {
  return peerplays.signer(
    payload,
    TESTING_ACCOUNT.pubKeys.active,
    arbitrary,
    isHash,
    KEYPAIR.privateKey
  );
});

// Catching popout events
EventService.init(async (type, data) => {
  // console.log('event', type, data);
  console.log('messages', data.payload.messages);
  return { result: { accepted: true } };
});

// Overriding plugin repo
PluginRepository.plugin = () => peerplays;

// Loading fake identity (for signerWithPopup)
// StoreService.get().state.scatter.keychain.identities[0].publicKey
StoreService.init({
  state: {
    scatter: {
      keychain: {
        identities: [
          {
            publicKey: TESTING_ACCOUNT.pubKeys.active,
          },
        ],
      },
    },
  },
});

// Turning off hardware checking (relies on StoreService)
KeyPairService.isHardware = () => false;

// Used for tests requiring a Scatter account object
const dummyAccount = {
  keypairUnique: 'thing',
  networkUnique: 'ppy:chain:1',
  publicKey: TESTING_ACCOUNT.pubKeys.active,
  name: TESTING_ACCOUNT.username,
  authority: 'active',
  fromOrigin: null,
  network: () => network,
};

// Used for tests requiring public and private keys
const testingKeys = {
  pubActive: TESTING_ACCOUNT.pubKeys.active,
  privActive: TESTING_ACCOUNT.wifs.active,
  pubMemo: TESTING_ACCOUNT.pubKeys.memo,
  privMemo: TESTING_ACCOUNT.wifs.memo,
};

describe('peerplays', () => {
  it('wif memo => public memo key', async () => {
    const wif = '5KQwCkL561FYfED6LiA6Z3NCvKdAPWPX1AbYVSEPsD3yANTnFjx';
    console.log(_PPY.privateFromWif(wif).toPublicKey().toPublicKeyString('TEST'));
  });

  it("should convert a private key WIF to it's public key (privateToPublic)", async () => {
    const [wif, prefix, publicKey] = [
      TESTING_ACCOUNT.wifs.active,
      TESTING_ACCOUNT.prefix,
      TESTING_ACCOUNT.pubKeys.active,
    ];
    assert(peerplays.privateToPublic(wif, prefix) === publicKey, 'Bad public key');
  });

  it("should convert a private key WIF to it's PrivateKey counterpart (privateFromWif)", async () => {
    const ppy = peerplays;
    const wif = TESTING_ACCOUNT.wifs.active;
    const pk = _PPY.privateFromWif(wif);
    assert(
      ppy.privateToPublic(ppy.wifFromPrivate(pk), TESTING_ACCOUNT.prefix) ===
        TESTING_ACCOUNT.pubKeys.active
    );
  });

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

  it('should be able to sign (signer)', async () => {
    const { from, to, token, asset } = transactionTest;
    let { amount } = transactionTest;
    const memo = 'test memo';
    amount = _PPY.convertToChainAmount(amount, token);
    let tr = await _PPY.getTransferTransaction(from, to, amount, memo, asset);

    // Build payload
    let payload = {};
    payload.transaction = tr;
    tr = await peerplays.signer(
      payload,
      TESTING_ACCOUNT.pubKeys.active,
      true,
      true,
      KEYPAIR.privateKey
    );
    assert(tr.signer_private_keys.length > 0);
  });

  it('should be able to transfer a balance WITHOUT & WITH a memo', async () => {
    const token = peerplays.defaultToken();
    token.amount = 1;

    const account = Account.fromJson({
      name: TESTING_ACCOUNT.username,
      authority: 'active',
      publicKey: TESTING_ACCOUNT.pubKeys.active,
    });

    // OVERRIDING NETWORK GETTER
    account.blockchain = () => Blockchains.PPY;
    account.network = () => network;
    account.keypair = () => KEYPAIR;

    const transferredNoMemo = await peerplays.transfer({
      account,
      to: transactionTest.to,
      amount: 1,
      token
    });

    assert(!transferredNoMemo.message);

    const transferredWithMemo = await peerplays.transfer({
      account,
      to: transactionTest.to,
      amount: 1,
      memo: 'test memo',
      token
    });

    assert(!transferredWithMemo.message);
  });

  it('should generate a Keypair instance successfully with a decodable "master" private key', async () => {
    const { privKeys } = Login.generateKeys(
      TESTING_ACCOUNT.username,
      TESTING_ACCOUNT.password,
      ['owner', 'active', 'memo'],
      TESTING_ACCOUNT.prefix
    );
    const wifs = {};

    // Generate WIF for each private key (3 for each authority level).
    for (const [authority, privKey] of Object.entries(privKeys)) {
      wifs[authority] = peerplays.wifFromPrivate(privKey);
    }

    // You can assign other keypair instances to the returned keypair as it is an instance of Scatter KeyPair
    // ie: keypair.blockchains = ['ppy']
    const keypair = PPYKeypairService.newKeypair(wifs, TESTING_ACCOUNT.prefix);
    const decryptedWifs = PPYKeypairService.getWifs(keypair.privateKey);

    assert(decryptedWifs.owner === TESTING_ACCOUNT.wifs.owner, 'owner key wif decrypt mismatch');
    assert(decryptedWifs.active === TESTING_ACCOUNT.wifs.active, 'active key wif decrypt mismatch');
    assert(decryptedWifs.memo === TESTING_ACCOUNT.wifs.memo, 'memo key wif decrypt mismatch');
  });
});
