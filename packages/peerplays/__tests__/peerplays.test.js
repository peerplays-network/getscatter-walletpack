'use strict';
import { assert } from 'chai';
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

describe('peerplays', () => {
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
