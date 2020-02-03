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
  // it('should be able to establish a connection', done => {
  //   new Promise(async () => {
  //     peerplays.init();
  //     done();
  //   });
  // });

  // it('should be able to get all balances', done => {
  // 	new Promise(async() => {
  // 		setTimeout(async() => {
  // 			const account = Account.fromJson({
  // 				keypairUnique:keypair.unique(),
  // 				networkUnique:network.unique(),
  // 				publicKey:keypair.publicKeys[0].key,
  // 				name: '<peerplays username goes here>'
  // 			});

  // 			const token = [ Token.fromJson({
  // 				// contract:'TCN77KWWyUyi2A4Cu7vrh5dnmRyvUuME1E',
  // 				blockchain:Blockchains.PPY,
  // 				symbol:'PPY',
  // 				decimals:8,
  // 				chainId:network.chainId
  // 			})]
  // 			let x = await peerplays.balancesFor(account, token)
  // 			console.log('RESULT', x);
  // 			done();
  // 		}, 5000);
  // 	})
  // });
  
  it('defaultDecimals', done => {
    new Promise(async() => {
            let x = await peerplays.defaultDecimals('1.3.0')
            console.log('RESULT', x);
            done();
    })
});

it('defaultToken()', done => {
    new Promise(async() => {
            let x = await peerplays.defaultToken()
            console.log('RESULT', x);
            done();
    })
});

it('isValidRecipient()', done => {
  new Promise(async() => {
          let x = await peerplays.isValidRecipient('init1')
          console.log('RESULT', x);
          done();
  })
});

//   it('should be able to retrieve a Peerplays accounts keys', async() => {
//     const username = 'init1';
//     assert.typeOf(await peerplays.getAccountKeys(username), 'object')
//   })

//   it('should be able to retrieve a Peerplays account', async() => {
//     const username = 'init1';
//     assert.typeOf(await peerplays.getFullAccount(username), 'object');
//   });

//   it('should successfully authorize a Peerplays account', async() => {
//     const username = 'testuser45';
//     const password = 'eu9xbavfc9DNWXd72P1TqHcwxjpY4YIuoYGlDq7Mw3COoqgILMer';
//     assert.equal(await peerplays.authUser(username, password), true)
//   });

//   it('should attempt to register a new Peerplays account (ip limit)', async() => {
//     const username = RandomString.generate({
//       length: 12,
//       charset: 'alphanumeric'
//     });

//     const password = RandomString.generate({
//       length: 52,
//       charset: 'alphanumeric'
//     });

//     console.log(`Testing registration with following data: \nusername: ${username} \npassword: ${password}`)

//     assert.typeOf(await peerplays.register(1, username, password), 'object');
//   })
});
