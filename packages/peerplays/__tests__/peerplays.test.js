'use strict';
import { assert, should, expect } from 'chai';
require('isomorphic-fetch');

import Account from '@walletpack/core/lib/models/Account';
import Network from '@walletpack/core/lib/models/Network';
import Keypair from '@walletpack/core/lib/models/Keypair';
import { Blockchains } from '@walletpack/core/lib/models/Blockchains';
import Token from '@walletpack/core/lib/models/Token';
import { ResolvePlugin } from 'webpack';
import { asset } from 'peerplaysjs-lib/dist/serializer/src/operations';

const peerplays = new (require('../lib/peerplays').default)();
const RandomString = require('randomstring');
const prefix = 'TEST';

const keypair = Keypair.fromJson({
  name: 'Testing key',
  publicKeys: [
    { blockchain: Blockchains.PPY, key: 'PPY74mnbzYG9WRVL9NQM39LQZw6sJ9WQguqp4kJm8NcQ8tGhXNa2r' },
  ],
  privateKey: '...',
});
const network = Network.fromJson({
  name: 'Peerplays Mainnet',
  host: 'seed01.eifos.org',
  port: 7777,
  protocol: 'https',
  chainId: '6b6b5f0ce7a36d323768e534f3edb41c6d6332a541a95725b98e28d140850134',
});

const account = Account.fromJson({
  keypairUnique: keypair.unique(),
  networkUnique: network.unique(),
  publicKey: keypair.publicKeys[0].key,
  name: 'se-dogperson420',
});

const token = Token.fromJson({
  // contract:'TCN77KWWyUyi2A4Cu7vrh5dnmRyvUuME1E',
  blockchain: Blockchains.PPY,
  symbol: 'PPY',
  decimals: 8,
  chainId: network.chainId,
});

// Removing need for StoreService's state
account.network = () => network;
account.sendable = () => account.publicKey;

describe('peerplays', () => {
  const TEST_KEY = '5KTyQ6kq2faYWzgVpLMCAkb97npLySCFk1KDa57tgZScUge2BYX';
  const TEST_PUBLIC_KEY = 'TEST6UdzJXcRwdRCfsV5tYGWzmMs5CvPnKqymTX1DkhFQdFFUmizBA';

  it('defaultDecimals', done => {
    new Promise(async () => {
      let x = await peerplays.defaultDecimals('1.3.0');
      console.log('RESULT', x);
      assert(typeof x === 'number', 'invalid decimal count');
      done();
    });
  });

  it('defaultToken()', done => {
    new Promise(async () => {
      let x = await peerplays.defaultToken();
      console.log('RESULT', x);
      done();
    });
  });

  it('isValidRecipient()', done => {
    new Promise(async () => {
      let x = await peerplays.isValidRecipient('init1');
      console.log('RESULT', x);
      assert(x === true, 'recipient invalid name');
      done();
    });
  });


  it('should check return a properly formatted account', done => {
    new Promise(async () => {
      const account = Account.fromJson({
        name:'test',
      })
        assert(peerplays.accountFormatter(account) === 'test', 'Bad account formatter');
        done();
    })
  });

  it('should get the endorsed network', done => {
      new Promise(async () => {
        const network = peerplays.getEndorsedNetwork();
        assert(network && network.blockchain === Blockchains.PPY, 'Bad endorsed network');
        assert(peerplays.isEndorsedNetwork(network), 'Bad endorsed network check');
        done();
      })
  });

  it('should convert a private key to a public key', done => {
    new Promise(async () => {
      assert(peerplays.privateToPublic(TEST_KEY, prefix) === TEST_PUBLIC_KEY, 'Bad public key'); // Prefix TEST on testnets
      // console.log('privateToPublic result', peerplays.privateToPublic('5KTyQ6kq2faYWzgVpLMCAkb97npLySCFk1KDa57tgZScUge2BYX'));
      // assert(peerplays.privateToPublic('5KTyQ6kq2faYWzgVpLMCAkb97npLySCFk1KDa57tgZScUge2BYX') === TEST_PUBLIC_KEY, 'Mismatched public key');
      done();
    });
  });

  it('should check if a private key is valid', done => {
    new Promise(async () => {
      assert(peerplays.validPrivateKey(TEST_KEY), 'Bad private key checker 1');
      // assert(!peerplays.validPrivateKey('5KTyQ6kq2faYWzgVpLMCAkb97npLySCFk1KDa57tgZScUge2BYX'), 'Bad private key checker 2');
      done();
    });
  });

  it('should check if a public key is valid', done => {
    new Promise(async () => {
      assert(peerplays.validPublicKey(TEST_PUBLIC_KEY, prefix), 'Bad public key checker [1]');
      done();
    })
});

  it('should convert a private key to a buffer', done => {
      new Promise(async () => {
        const bufKey = peerplays.hexPrivateToBuffer(TEST_KEY);
        assert(Buffer.isBuffer(bufKey), 'Bad buffer key');
        done();
      })
  });
	
  it('should convert a buffer to a private key', done => {
      new Promise(async () => {
        const buffer = peerplays.hexPrivateToBuffer(TEST_KEY);
        assert(peerplays.bufferToHexPrivate(buffer) === TEST_KEY, 'Bad buffer key conversion');
        done();
      })
  });

  it('should be able to retrieve a Peerplays accounts keys', async () => {
    const username = 'init1';
    assert.typeOf(await peerplays.getAccountKeys(username), 'object');
  });

  it('should be able to retrieve a Peerplays account', async () => {
    const username = 'init1';
    assert.typeOf(await peerplays.getFullAccount(username), 'object');
  });

  it('should successfully authorize a Peerplays account', async () => {
    const username = 'testuser45';
    const password = 'eu9xbavfc9DNWXd72P1TqHcwxjpY4YIuoYGlDq7Mw3COoqgILMer';
    assert.equal(await peerplays.authUser(username, password), true);
  });

  it('should attempt to register a new Peerplays account (ip limit)', async () => {
    const username = RandomString.generate({
      length: 12,
      charset: 'alphanumeric',
    });

    const password = RandomString.generate({
      length: 52,
      charset: 'alphanumeric',
    });

    console.log(
      `Testing registration with following data: \nusername: ${username} \npassword: ${password}`
    );

    assert.typeOf(await peerplays.register(1, username, password), 'object');
  });
});
