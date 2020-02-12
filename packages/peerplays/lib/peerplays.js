import Plugin from '@walletpack/core/plugins/Plugin';
import * as PluginTypes from '@walletpack/core/plugins/PluginTypes';
import * as Actions from '@walletpack/core/models/api/ApiActions';
import { Blockchains } from '@walletpack/core/models/Blockchains';
import Network from '@walletpack/core/models/Network';
import KeyPairService from '@walletpack/core/services/secure/KeyPairService';
import Token from '@walletpack/core/models/Token';
import HardwareService from '@walletpack/core/services/secure/HardwareService';
import StoreService from '@walletpack/core/services/utility/StoreService';
import EventService from '@walletpack/core/services/utility/EventService';
import SigningService from '@walletpack/core/services/secure/SigningService';
import ecc from 'eosjs-ecc';
import BigNumber from 'bignumber.js';
const fetch = require('node-fetch');

import {
  ChainValidation,
  PublicKey,
  PrivateKey as Pkey
} from 'peerplaysjs-lib';
import _PPY from './_PPY';

//TO-DO: Replace with Peerplays explorer.
const EXPLORER = {
  name: 'PeerplaysBlockchain',
  account: 'https://peerplaysblockchain.info/account/{x}',
  transaction: 'https://peerplaysblockchain.info/explorer/transactions/{x}',
  block: 'https://peerplaysblockchain.info/block/{x}',
};

const MAINNET_CHAIN_ID = '6b6b5f0ce7a36d323768e534f3edb41c6d6332a541a95725b98e28d140850134';
let cachedInstances;

export default class PPY extends Plugin {
  constructor() {
    super('ppy', PluginTypes.BLOCKCHAIN_SUPPORT);
  }

  bip() {
    return `44'/194'/0'/0/`;
  }

  bustCache() {
    cachedInstances = {};
  }

  defaultExplorer() {
    return EXPLORER;
  }

  accountFormatter(account) {
    return account.name;
  }

  returnableAccount(account) {
    return { name: account.name, address: account.publicKey, blockchain: Blockchains.PPY };
  }

  // TO-DO:
  contractPlaceholder() {
    return '';
  }

  checkNetwork(network) {
    return Promise.race([
      new Promise(resolve => setTimeout(() => resolve(null), 2000)),
      fetch(`${network.fullhost()}/v1/chain/get_info`)
        .then(() => true)
        .catch(() => false),
    ]);
  }

  getEndorsedNetwork() {
    //TO-DO: Replace with Peerplays mainnet.
    return new Network(
      'Peerplays Mainnet',
      'https',
      'seed01.eifos.org',
      7777,
      Blockchains.PPY,
      MAINNET_CHAIN_ID
    );
  }

  isEndorsedNetwork(network) {
    const endorsedNetwork = this.getEndorsedNetwork();
    return network.blockchain === 'ppy' && network.chainId === endorsedNetwork.chainId;
  }

  async getChainId() {
    return await _PPY.getChainId();
  }

  usesResources() {
    return false;
  }

  hasAccountActions() {
    return false;
  }

  accountsAreImported() {
    return true;
  }

  isValidRecipient(name) {
    return ChainValidation.is_account_name(name);
  }

  privateToPublic(privateKeyWif, prefix = null) {
    return _PPY.privateFromWif(privateKeyWif)
      .toPublicKey()
      .toPublicKeyString(prefix ? prefix : 'PPY');
  }

  /**
   * Convert a PrivateKey object to a Wallet Import Format (WIF) key
   *
   * @param {Object} privateKey
   * @returns {String} - Wallet Import Format (WIF) key
   * @memberof PPY
   */
  wifFromPrivate(privateKey) {
    return privateKey.toWif();
  }

  validPrivateKey(privateKey) {
    return privateKey.length >= 50 && ecc.isValidPrivate(privateKey);
  }

  validPublicKey(publicKey, prefix = null) {
    try {
      return PublicKey.fromStringOrThrow(publicKey, prefix ? prefix : 'PPY');
    } catch (e) {
      return false;
    }
  }

  bufferToHexPrivate(buffer) {
    const bufKey = Pkey.fromBuffer(Buffer.from(buffer));
    return bufKey.toWif();
  }

  hexPrivateToBuffer(privateKey) {
    return new Pkey.fromWif(privateKey).toBuffer();
  }

  hasUntouchableTokens() {
    return false;
  }

  defaultDecimals() {
    return 5; // ui does not call this async so we have to hardcode
  }

  defaultToken() {
    return new Token(Blockchains.PPY, 'ppy', 'PPY', 'PPY', 5, MAINNET_CHAIN_ID);
  }

  actionParticipants(payload) {
    return payload.transaction.participants;
  }

  /***
   * Gets an array of token's values.
   * The `tokens` param might also be omitted which would mean to grab "all available tokens for an account".
   * Returns an array of Token class.
   */
  async balancesFor(account, tokens, fallback = false) {
    let fullAccount = await _PPY.getFullAccountObject(account.name);
    let unformattedBalance;
    let tokenArray = [];
    let assetId = '1.3.0';

    tokens.map(async token => {
      const t = token.clone();
      const symbol = token.symbol.toUpperCase();

      if (symbol === 'PPY') {
        assetId = '1.3.0';
      } else if (symbol === 'BTF') {
        assetId = '1.3.1';
      }

      let assetIndex = fullAccount.balances.findIndex(asset => asset.asset_type === assetId);

      if (assetIndex === -1) {
        return;
      }

      unformattedBalance = fullAccount.balances[assetIndex].balance;
      const balance =
        new BigNumber(unformattedBalance) / Math.pow(10, await this.defaultDecimals(assetId));
      t.amount = balance;
      tokenArray.push(t);
    });

    return tokenArray;
  }

  /***
   * Gets a single token's balance.
   * Returns a Token class where `token.amount` is the balance.
   */
  async balanceFor(account, token) {
    let fullAccount = await _PPY.getFullAccountObject(account.name);
    let unformattedBalance;
    let assetId = '1.3.0';

    if (token.symbol.toUpperCase() === 'PPY') {
      assetId = '1.3.0';
    } else if (token.symbol.toUpperCase() === 'BTF') {
      assetId = '1.3.1';
    }
    const assetIndex = fullAccount.balances.findIndex(asset => asset.asset_type === assetId);
    unformattedBalance = fullAccount.balances[assetIndex].balance;
    const balance =
      new BigNumber(unformattedBalance) / Math.pow(10, await this.defaultDecimals(assetId));
    const clone = token.clone();
    clone.amount = balance;
    return clone;
  }

  async signerWithPopup(payload, account, rejector) {
    return new Promise(async resolve => {
      payload.messages = await this.requestParser(payload);
      payload.identityKey = StoreService.get().state.scatter.keychain.identities[0].publicKey;
      payload.participants = [account];
      payload.network = account.network();
      payload.origin = 'Scatter';
      const request = {
        payload,
        origin: payload.origin,
        blockchain: Blockchains.TRX,
        requiredFields: {},
        type: Actions.SIGN,
        id: 1,
      };

      EventService.emit('popout', request).then(async ({ result }) => {
        if (!result || !result.accepted || false)
          return rejector({ error: 'Could not get signature' });

        let signature = null;
        if (KeyPairService.isHardware(account.publicKey)) {
          signature = await HardwareService.sign(account, payload);
        } else signature = await SigningService.sign(payload.network, payload, account.publicKey);

        if (!signature) return rejector({ error: 'Could not get signature' });

        resolve(signature);
      }, true);
    });
  }

  async requestParser(payload, network) {
    if (payload.transaction.hasOwnProperty('serializedTransaction'))
      return this.parseEosjs2Request(payload, network);
    else return this.parseEosjsRequest(payload, network);
  }

  /**
   * Add the keys needed to sign the transaction.
   *
   * @param {Object} transaction
   * @param {Object} publicKey
   * @param {boolean} [arbitrary=false]
   * @param {boolean} [isHash=false]
   * @param {Object} [privateKey=null]
   * @returns {Object} transaction
   * @memberof PPY
   */
  async signer(transaction, publicKey, arbitrary = false, isHash = false, privateKey = null) {
    if (!publicKey && privateKey) {
      publicKey = this.privateToPublic(privateKey);
    }

    // Sign the Peerplays transaction with private and public key
    transaction.add_signer(privateKey, publicKey);

    return transaction;

    // if (!privateKey) privateKey = await KeyPairService.publicToPrivate(publicKey);
    // if (!privateKey) return;

    // if (typeof privateKey !== 'string') privateKey = this.bufferToHexPrivate(privateKey);

    // if (arbitrary && isHash) return ecc.Signature.signHash(payload.data, privateKey).toString();
    // return ecc.sign(Buffer.from(arbitrary ? payload.data : payload.buf, 'utf8'), privateKey);
  }

  /**
   * Perform transfer...
   * TODO: ensure returns expected, what is transaction_id?
   *
   * @param {{account: Object, to: String, amount: Number, memo: String, token: String, promptForSignature: Boolean}}
   * @param {Object} testingKeys - If called via unit test, provide this.
   * @returns {Promise} resolve/reject - Resolve with transaction id if their is one. Reject with error if there is one.
   * @memberof PPY
   */
  async transfer({ account, to, amount, memo, token, promptForSignature = true }, testingKeys) {
    const from = account.name;
    const publicActiveKey = account.publicKey;
    const asset = token;

    // Get the transaction
    let transferTransaction = await _PPY.getTransferTransaction(from, to, amount, memo, asset);

    // Sign the transaction
    if (promptForSignature) {
      // transferTransaction = this.signerWithPopup(transferTransaction, account, )
    } else {
      transferTransaction = await _PPY.signer(
        transferTransaction,
        publicActiveKey,
        false,
        false,
        privateActiveKey
      ); // TODO: need keys to work
    }

    if (testingKeys) {
      const { pubActive, privActive } = testingKeys;

      transferTransaction = await this.signer(
        transferTransaction,
        pubActive,
        false,
        false,
        privActive
      );
    }

    // Finalize the transaction
    transferTransaction = await _PPY.finalize(transferTransaction);

    const callback = () => {
      console.log('callback executing after broadcast');
    };

    // Broadcast the transaction
    return new Promise((resolve, reject) => {
      _PPY.broadcast(transferTransaction, callback).then(() => {
        resolve(/* transaction_id */)
      }).catch(err => {
        reject(err);
      });
    });
  }
}
