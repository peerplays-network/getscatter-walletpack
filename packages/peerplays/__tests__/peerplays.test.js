'use strict';
import { assert } from 'chai';
require('isomorphic-fetch');

const peerplays = new (require('../lib/peerplays').default)();
const RandomString = require('randomstring');

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

    // console.log(
    //   `Testing registration with following data: \nusername: ${username} \npassword: ${password}`
    // );

    assert.typeOf(await peerplays.register(1, username, password), 'object');
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
