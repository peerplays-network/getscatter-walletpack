'use strict';
import { assert, expect } from 'chai';
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
  },
  prefix: 'PPY'
};

// If using a non mainnet account, provide account data above and change the assignment below.
const TESTING_ACCOUNT = mainnetTester; // don't forget to update the endpoint in use in peerplays.js if using a non-mainnet account

// TODO: remove?
// account keys for 'unit39'
// const KEYPAIR = Keypair.fromJson({
//   privateKey: mainnetTester.wifs.active,
//   blockchains: [Blockchains.PPY],
//   publicKeys: [{
//     key: 'PPY8QGhjBytYZrHpmDorLM4ETsoDYXGbGH3WT8sTrhu3LUJQ9ePf5', // active
//     blockchain: Blockchains.PPY
//   }]
// });

describe('peerplays', () => {
  it('should convert a private key WIF to it\'s public key (privateToPublic)', async () => {
    const [wif, prefix, publicKey] = [TESTING_ACCOUNT.wifs.active, TESTING_ACCOUNT.prefix, TESTING_ACCOUNT.pubKeys.active]
    assert(peerplays.privateToPublic(wif, prefix) === publicKey, 'Bad public key');
  })

  it('should convert a private key WIF to it\'s PrivateKey counterpart (privateFromWif)', async () => {
    const ppy = peerplays;
    const wif = TESTING_ACCOUNT.wifs.active;
    const pk = peerplays.privateFromWif(wif);
    assert(ppy.privateToPublic(ppy.wifFromPrivate(pk)) === TESTING_ACCOUNT.pubKeys.active);
  })

  it('should be able to retrieve a Peerplays accounts keys', async () => {
    const username = 'init1';
    assert.typeOf(await peerplays.getAccountKeys(username), 'object');
  });

  it('should be able to retrieve a full Peerplays account', async () => {
    const username = 'init1';
    assert.typeOf(await peerplays.getFullAccount(username), 'object');
  });

  it('should successfully authorize a Peerplays account', async () => {
    assert.equal(await peerplays.authUser(mainnetTester.username, mainnetTester.password), true);
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
    const tr = await peerplays.getTransferTransaction(from, to, amount, memo, asset);
    expect(tr.operations[0][1].fee.amount).to.not.be.empty;
  });

  it('should successfully build a transfer transaction object with a memo', async () => {
    const from = 'init0';
    const to = 'init1';
    const amount = 10000;
    const memo = 'test memo';
    const asset = '1.3.0';

    // console.log(`Testing transfer transaction build with: \nfrom: ${from} \nto: ${to} \namount: ${amount} \nmemo: ${memo} \nasset: ${asset}`);
    const tr = await peerplays.getTransferTransaction(from, to, amount, memo, asset);
    expect(tr.operations[0][1].fee.amount).to.not.be.empty;
  });

  it('should successfully sign a transaction (signer)', async () => {
    const from = 'init0';
    const to = 'init1';
    const amount = 10000;
    const memo = 'test memo';
    const asset = '1.3.0';
    // sample transfer transaction
    let tr = await peerplays.getTransferTransaction(from, to, amount, memo, asset);
    tr = await peerplays.signer(tr, TESTING_ACCOUNT.pubKeys.active, false, false, peerplays.privateFromWif(TESTING_ACCOUNT.wifs.active));

    assert(tr.signer_private_keys.length > 0);
  });

  // it('should successfully broadcast a signed transaction (transfer)', async () => {
  //   const from = 'init0';
  //   const to = 'init1';
  //   const amount = 10000;
  //   const memo = 'test memo';
  //   const asset = '1.3.0';

  //   const tr = await peerplays.transfer({from, to, amount, memo, token: asset})
  // })
});
