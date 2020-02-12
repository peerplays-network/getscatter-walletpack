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
  Aes,
  ChainValidation,
  ChainConfig,
  ChainTypes,
  hash,
  Login,
  ops,
  PublicKey,
  PrivateKey as Pkey,
  Signature,
  TransactionBuilder,
  TransactionHelper,
} from 'peerplaysjs-lib';

//TO-DO: Replace with Peerplays explorer.
const EXPLORER = {
  name: 'PeerplaysBlockchain',
  account: 'https://peerplaysblockchain.info/account/{x}',
  transaction: 'https://peerplaysblockchain.info/explorer/transactions/{x}',
  block: 'https://peerplaysblockchain.info/block/{x}',
};

const methods = {
  GET_REQUIRED_FEES: 'get_required_fees',
  GET_OBJECTS: 'get_objects',
  GET_FULL_ACCOUNTS: 'get_full_accounts',
  GET_ACCOUNTS: 'get_accounts',
  GET_ASSET: 'lookup_asset_symbols',
  GET_CHAIN_ID: 'get_chain_id',
  BROADCAST: 'broadcast_transaction_with_callback',
};

const ROLES = ['owner', 'active', 'memo'];

const MAINNET_CHAIN_ID = '6b6b5f0ce7a36d323768e534f3edb41c6d6332a541a95725b98e28d140850134';

const MAINNET_ENDPOINT_1 = 'https://pma.blockveritas.co/ws';
const MAINNET_FAUCET = 'https://faucet.peerplays.download/api/v1/accounts';

const TESTNET_ENDPOINT_1 = '';
const TESTNET_FAUCET = '';

const DEFAULT_PREFIX = 'PPY';
const TESTNET_PREFIX = 'TEST';

// Override these for testnets
const PREFIX = TESTNET_PREFIX;
const ENDPOINT = TESTNET_ENDPOINT_1;
const FAUCET = TESTNET_FAUCET;

if (PREFIX !== DEFAULT_PREFIX) {
  ChainConfig.setPrefix(PREFIX);
}

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
    return await this._callChain(methods.GET_CHAIN_ID, []);
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

  privateFromWif(privateKeyWif) {
    return Pkey.fromWif(privateKeyWif);
  }

  wifFromPrivate(privateKey) {
    return privateKey.toWif();
  }

  privateToPublic(privateKeyWif, prefix = null) {
    return this.privateFromWif(privateKeyWif)
      .toPublicKey()
      .toPublicKeyString(prefix ? prefix : 'PPY');
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

  async defaultDecimals(assetId) {
    const asset = await this.getAsset(assetId);
    return asset.precision || 5;
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
    let fullAccount = await this.getFullAccountObject(account.name);
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
    let fullAccount = await this.getFullAccountObject(account.name);
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
   * Fetch the Peerplays blockchain for data.
   *
   * @param {String} method - The method associated with the request to be made.
   * @param {Array} params - The parameters associated with the method.
   * @returns {*} - The data from the request OR an error if there is one.
   * @memberof PPY
   */
  async _callChain(method, params, api = 'database') {
    const fetchBody = JSON.stringify({
      method: 'call',
      params: [api, method, params],
      jsonrpc: '2.0',
      id: 1,
    });

    return await fetch(ENDPOINT, {
      body: fetchBody,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-type': 'application/json',
      },
    })
      .catch(err => {
        throw new Error(err);
      })
      .then(res => res.json())
      .then(res => {
        if (res.result) return res.result;

        if (res.error) {
          throw new Error(res.error.message);
        }

        return res;
      });
  }

  /**
   * Retrieve the asset information from the Peerplays chain.
   *
   * @param {String} assetID - The asset id to request information for ie: '1.3.0'.
   * @returns
   * @memberof PPY
   */
  async getAsset(assetID) {
    if (!assetID) {
      throw new Error('getAsset: Missing inputs');
    }
    const res = await this._callChain(methods.GET_ASSET, [[assetID]]);
    return res[0];
  }

  /**
   * Returns data objects from chain for provided array of object ids.
   * this.getObject(['1.3.0'])
   *
   * @param {Array} objIds - The list of ids to retrieve data from the Peerplays chain.
   * @returns {Array} - An array of the objects requested.
   * @memberof PPY
   */
  async getObjects(objIds) {
    if (!objIds || objIds.length === 0) {
      throw new Error('getObjects: Missing inputs');
    }
    return await this._callChain(methods.GET_OBJECTS, [[objIds]]);
  }

  /**
   * Requests from Peerplays blockchain for account data object.
   *
   * @param {String} accountNameOrId - The Peerplays account username to request data for.
   * @returns {Object}
   * @memberof PPY
   */
  async getFullAccount(accountNameOrId) {
    if (!accountNameOrId) {
      throw new Error('getFullAccount: Missing input');
    }
    const res = await this._callChain(methods.GET_FULL_ACCOUNTS, [[accountNameOrId], true]);
    return res[0][1].account;
  }

  /**
   * Requests from Peerplays blockchain for full object.
   *
   * @param {String} accountNameOrId - The Peerplays account username to request data for.
   * @returns {Object}
   * @memberof PPY
   */
  async getFullAccountObject(accountNameOrId) {
    if (!accountNameOrId) {
      throw new Error('getFullAccount: Missing input');
    }
    const res = await this._callChain(methods.GET_FULL_ACCOUNTS, [[accountNameOrId], true]);
    return res[0][1];
  }

  /**
   * Used by setRequiredFees.
   *
   * @param {Array} ops - The operations within a TransactionBuilder instance.
   * @param {String} assetId - The id of the asset to use ie: '1.3.0'.
   * @returns {Array} - An array of objects containing the fees associated with the provided `ops`.
   * @memberof PPY
   */
  async getRequiredFees(ops, assetId) {
    if (!ops || !assetId) {
      throw new Error('getRequiredFees: Missing inputs');
    }
    return await this._callChain(methods.GET_REQUIRED_FEES, [ops, assetId]);
  }

  /**
   * Get the requires fees associated with an operation.
   *
   * @param {String} opToPrice
   * @returns {Object} fees
   * @memberof PPY
   */
  async getFees(opToPrice) {
    if (!opToPrice) {
      throw new Error('getFee: Missing inputs');
    }

    const op = ChainTypes.operations[opToPrice];

    if (op === undefined) {
      throw new Error('getFee: No operation matching request');
    }

    let fee;

    // Get the fee schedule
    const obj200 = await this.getObjects('2.0.0');
    const feeSchedule = obj200[0].parameters.current_fees.parameters;

    // Return the fees associated with `opToPrice`
    return feeSchedule[op][1];
  }

  /**
   * By providing a transaction builder instance transaction and the asset to use for the fees, this function will
   * return the fees associated with all operations within said transaction object instance.
   *
   * @param {String} assetId
   * @param {Object} tr - The instance of TransactionBuilder associated with the transaction requiring fees to be set.
   * @returns {Object} - The transaction that was passed in with the fees set on the operations within it.
   * @memberof PPY
   */
  async setRequiredFees(assetId, tr) {
    if (!tr.operations) {
      throw new Error('setRequiredFees: transaction has no operations');
    }

    let feePool;
    let operations = [];

    for (let i = 0, len = tr.operations.length; i < len; i++) {
      let op = tr.operations[i];
      operations.push(ops.operation.toObject(op)); // serialize with peerplaysjs-lib
    }

    if (!assetId) {
      let op1_fee = operations[0][1].fee;

      if (op1_fee && op1_fee.asset_id !== null) {
        assetId = op1_fee.asset_id;
      } else {
        assetId = '1.3.0';
      }
    }

    let fees = await this.getRequiredFees(operations, assetId);

    if (assetId !== '1.3.0') {
      feePool = dynamicObject ? dynamicObject[0].fee_pool : 0;
      let totalFees = 0;
      for (let j = 0, fee; j < coreFees.length; j++) {
        fee = coreFees[j];
        totalFees += fee.amount;
      }
      if (totalFees > parseInt(feePool, 10)) {
        fees = coreFees;
        assetId = '1.3.0';
      }
    }

    // Proposed transactions need to be flattened
    let flatAssets = [];

    let flatten = obj => {
      if (Array.isArray(obj)) {
        for (let k = 0, len = obj.length; k < len; k++) {
          let item = obj[k];
          flatten(item);
        }
      } else {
        flatAssets.push(obj);
      }
    };

    flatten(fees);

    let assetIndex = 0;

    let setFee = operation => {
      if (
        !operation.fee ||
        operation.fee.amount === 0 ||
        (operation.fee.amount.toString && operation.fee.amount.toString() === '0') // Long
      ) {
        operation.fee = flatAssets[assetIndex];
        // console.log("new operation.fee", operation.fee)
      }
      assetIndex++;
      return operation.fee;
    };

    for (let i = 0; i < operations.length; i++) {
      tr.operations[0][1].fee = setFee(operations[i][1]);
    }

    return tr;
  }

  /**
   * Requests a users' public keys from the Peerplays blockchain.
   * Keys are returned as an array with key order of owner, active, then memo.
   *
   * @param {String} accountNameOrId - ie: 'mcs' || '1.2.26'
   * @returns {Array} keys - [ownerPublicKey, activePublicKey, memoPublicKey]
   */
  async getAccountKeys(accountNameOrId) {
    const keys = {};
    const account = await this.getFullAccount(accountNameOrId);
    ROLES.forEach(role => {
      let key;

      if (role === 'memo') {
        key = [[account.options.memo_key, 1]];
      } else {
        key = account[role].key_auths;
      }

      keys[role] = key;
    });

    return keys;
  }

  /**
   * peerplaysjs-lib.Login will generate keys from provided data and compare them with the ones pulled from the
   * Peerplays blockchain (`userPubKeys`).
   *
   * @param {String} username - The login username to associate with the account to be registered.
   * @param {String} password - The login password to associate with the account to be registered.
   * @returns {Boolean}
   */
  async authUser(username, password) {
    // Ensure the Login class has the correct roles configured.
    Login.setRoles(ROLES);

    const userPubKeys = await this.getAccountKeys(username);

    const user = {
      accountName: username,
      password,
      auths: userPubKeys,
    };

    // TODO: modify this such that the Scatter UI has the data it requires to import an existing account. Likely will require to generate keys and return them to something
    const authed = Login.checkKeys(user, PREFIX);

    return authed;
  }

  /**
   * Will generate keys from username and password via the peerplaysjs-lib.
   * The public keys for owner, active, and memo are then sent to the faucet that handles account registrations for the configured chain.
   * Once keys are generated and adequate data is provided, a register attempt will be made to the configured faucet endpoint.
   * A Peerplays account password should be generated via randomstring npm package.
   *
   * @param {Number} attempt - The number of attempts to start off with.
   * @param {String} username - The login username to associate with the account to be registered.
   * @param {String} password - The login password to associate with the account to be registered.
   * @param {String} referral - Optional referral Peerplays account username.
   * @returns {Object} - The account data that was registered if successful or associated error if registration failed ie:
   * {
   *   account: {
   *     active_key: 'TEST6vw2TA6QXTXWHeoRhq6Sv7F4Pdq5fNkddBGbrY31iCRjEDZnby',
   *     memo_key: 'TEST8C7kCkp6rd3UP4ayVS2o2WyEh9MgrY2Ud4b8SXCWEUfBAspNa6',
   *     name: 'mcs4455',
   *     owner_key: 'TEST7HERrHiogdB5749RahGDKoMHhK3qbwvWABvqpVARrY76b2qcTM',
   *     referrer: 'nathan'
   *  }
   * }
   * @memberof PPY
   */
  async register(attempt, username, password, referral = null) {
    Login.setRoles(ROLES);
    let keys = Login.generateKeys(username, password, ROLES, PREFIX);
    const [ownerPub, activePub, memoPub] = [
      keys.pubKeys.owner,
      keys.pubKeys.active,
      keys.pubKeys.memo,
    ];

    if (!attempt || !username || !password) {
      throw new Error('register: Missing inputs');
    }

    const fetchBody = JSON.stringify({
      account: {
        name: username,
        owner_key: ownerPub,
        active_key: activePub,
        memo_key: memoPub,
        refcode: referral || '',
        referrer: referral,
      },
    });

    // We use a separate fetch here as we want this to potentially have multiple tries.
    return await fetch(FAUCET, {
      method: 'post',
      mode: 'cors',
      headers: {
        Accept: 'application/json',
        'Content-type': 'application/json',
      },
      body: fetchBody,
    })
      .then(res => res.json())
      .catch(err => {
        if (attempt > 2) {
          throw new Error(err);
        } else {
          attempt++;
          return this.register(attempt, username, password);
        }
      });
  }

  /**
   * Construct an unsigned transaction for a transfer operation with correct fees.
   *
   * @param {Object} args - Required params for the construction of the transaction and its operations.
   * @param {String} from - The sending Peerplays account name.
   * @param {String} to - The recipient Peerplays account name.
   * @param {Number} amount - The numerical amount of funds to send to the recipient.
   * @param {String} memo - The optional message to send along with the funds being transferred.
   * @param {String} asset - The Peerplays asset (User Issued Asset token) id associated with the transfer.
   * @param {String} proposeAccount - Optional, default null. The Peerplays account name to be proposed.
   * @param {Boolean} encryptMemo - Optional, default true. Whether or not to encrypt the memo.
   *
   * @returns {Object} - A TransactionBuilder transaction instance with fees set on the transaction for a transfer operation.
   * @memberof PPY
   */
  async getTransferTransaction(
    from,
    to,
    amount,
    memo,
    asset,
    proposeAccount = null,
    encryptMemo = true,
    optional_nonce = null
  ) {
    let feeAssetId = asset;
    if (!from || !to || !amount || !asset) {
      throw new Error('transfer: Missing inputs');
    }

    let memoToPublicKey;

    // get account data for `from`, `to`, & `proposeAccount`
    const [chainFrom, chainTo] = [await this.getFullAccount(from), await this.getFullAccount(to)];
    const chainProposeAccount = proposeAccount && (await this.getFullAccount(proposeAccount));

    // get asset data
    let chainAsset = await this.getAsset(asset);

    // If we have a non-empty string memo and are configured to encrypt...
    if (memo && encryptMemo) {
      memoToPublicKey = chainTo.options.memo_key;

      // Check for a null memo key, if the memo key is null use the receivers active key
      if (/PPY1111111111111111111111111111111114T1Anm/.test(memoToPublicKey)) {
        memoToPublicKey = chainTo.active.key_auths[0][0];
      }
    }

    let proposeAcountId = proposeAccount ? chainProposeAccount.id : null;
    let memoObject;

    //=================================================================
    // TODO: remove this once we have keys from Scatter to use instead
    //=================================================================
    const username = 'miigunner69';
    const pw = 'QZvbzqGng8BMYzcFW4O5TpqJEwOXmy72O0ceLVwUqeuZ4grRnVmI';
    const { privKeys } = Login.generateKeys(username, pw, ROLES, PREFIX);
    // const memoPrivateKey = privKeys.memo;
    const wifMemo = '5KQwCkL561FYfED6LiA6Z3NCvKdAPWPX1AbYVSEPsD3yANTnFjx';
    const memoPrivateKey = this.privateFromWif(wifMemo);
    const memoPublicKey = memoPrivateKey.toPublicKey().toPublicKeyString(PREFIX);
    //=================================================================

    if (memo && memoToPublicKey && memoPublicKey) {
      let nonce = optional_nonce == null ? TransactionHelper.unique_nonce_uint64() : optional_nonce;

      const message = Aes.encrypt_with_checksum(
        memoPrivateKey, // From Private Key
        memoToPublicKey, // To Public Key
        nonce,
        memo
      );

      memoObject = {
        from: memoPublicKey, // From Public Key
        to: memoToPublicKey, // To Public Key
        nonce,
        message,
      };
    }

    // Allow user to choose asset with which to pay fees
    let feeAsset = chainAsset;

    // Default to CORE in case of faulty core_exchange_rate
    if (
      feeAsset.options.core_exchange_rate.base.asset_id === '1.3.0' &&
      feeAsset.options.core_exchange_rate.quote.asset_id === '1.3.0'
    ) {
      feeAssetId = '1.3.0';
    }

    let tr = new TransactionBuilder();

    let transferOp = tr.get_type_operation('transfer', {
      fee: {
        amount: 0,
        asset_id: feeAssetId,
      },
      from: chainFrom.id,
      to: chainTo.id,
      amount: {
        amount,
        asset_id: chainAsset.id,
      },
      memo: memoObject,
    });

    if (proposeAccount) {
      let proposalCreateOp = tr.get_type_operation('proposal_create', {
        proposed_ops: [{ op: transferOp }],
        fee_paying_account: proposeAcountId,
      });
      tr.add_operation(proposalCreateOp);
      tr.operations[0][1].expiration_time = parseInt(Date.now() / 1000 + 5);
    } else {
      tr.add_operation(transferOp);
    }

    // Set the transaction fees for the new transaction
    return await this.setRequiredFees(undefined, tr);
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
   * Finalize transaction.
   *
   * @param {Object} tr - TransactionBuilder instance.
   * @returns {Object} - tr
   * @memberof PPY
   */
  async finalize(tr) {
    if (tr.signer_private_keys.length < 1) {
      throw new Error('not signed');
    }

    if (tr.tr_buffer) {
      throw new Error('already finalized');
    }

    const obj210 = await this._callChain(methods.GET_OBJECTS, [['2.1.0']]);
    tr.head_block_time_string = obj210[0].time;

    if (tr.expiration === 0) {
      tr.expiration = tr.base_expiration_sec() + ChainConfig.expire_in_secs;
    }

    tr.ref_block_num = obj210[0].head_block_number & 0xffff;
    tr.ref_block_prefix = Buffer.from(obj210[0].head_block_id, 'hex').readUInt32LE(4);

    let iterable = tr.operations;

    for (let i = 0, len = iterable.length; i < len; i++) {
      let op = iterable[i];

      if (op[1].finalize) {
        op[1] = op[1].finalize();
      }

      let _type = ops.operation.st_operations[op[0]];
      let hexBuffer = _type.toBuffer(op[1]).toString('hex');
      // console.log(
      //   'Operation %s: %O => %s (%d bytes)',
      //   _type.operation_name,
      //   op[1],
      //   hexBuffer,
      //   hexBuffer.length / 2
      // );
    }

    tr.tr_buffer = ops.transaction.toBuffer(tr);

    return tr;
  }

  /**
   * Sign the transaction with the keys in `signer_private_keys`
   *
   * @private
   * @param {Object} tr
   * @param {String} chainId
   * @returns {Object} transaction
   * @memberof PPY
   */
  async _sign(tr, chainId) {
    if (!tr || !chainId) {
      throw new Error('_sign: Missing inputs');
    }

    if (!tr.tr_buffer) {
      throw new Error('not finalized');
    }

    if (tr.signatures.length > 0) {
      throw new Error('already signed');
    }

    if (!tr.signer_private_keys.length) {
      throw new Error('Transaction was not signed. Do you have a private key? [no_signers]');
    }

    let end = tr.signer_private_keys.length;

    for (let i = 0; end > 0 ? i < end : i > end; i++) {
      let [private_key, public_key] = tr.signer_private_keys[i];
      let sig = Signature.signBuffer(
        Buffer.concat([Buffer.from(chainId, 'hex'), tr.tr_buffer]),
        private_key,
        public_key
      );
      tr.signatures.push(sig.toBuffer());
    }

    tr.signer_private_keys = [];
    tr.signed = true;
    return tr;
  }

  /**
   * Broadcast the transaction to the chain.
   *
   * @param {Object} tr - The transaction to broadcast.
   * @param {*} was_broadcast_callback - The callback to execute once successfully broadcasted.
   * @returns {Function||Error} was_broadcast_callback||new Error(...)
   * @memberof PPY
   */
  async broadcast(tr, was_broadcast_callback) {
    if (!tr || !was_broadcast_callback) {
      throw new Error('_broadcast: Missing inputs');
    }

    if (tr.signatures.length < 1) {
      const chainId = await this.getChainId();
      tr = await this._sign(tr, chainId);
    }

    if (!tr.tr_buffer) {
      throw new Error('not finalized');
    }

    if (!tr.signatures.length) {
      throw new Error('not signed');
    }

    if (!tr.operations.length) {
      throw new Error('no operations');
    }

    let tr_object = ops.signed_transaction.toObject(tr); // serialize

    return this._callChain(methods.BROADCAST, [res => res, tr_object], 'network_broadcast')
      .then(data => {
        if (was_broadcast_callback) {
          was_broadcast_callback();
        }
      })
      .catch(error => {
        console.log(error);
        let { message } = error;

        if (!message) {
          message = '';
        }

        throw new Error(
          `${message}\n` +
            'peerplays-crypto ' +
            ` digest ${hash
              .sha256(tr.tr_buffer)
              .toString('hex')} transaction ${tr.tr_buffer.toString('hex')} ${JSON.stringify(
              tr_object
            )}`
        );
      });
  }

  /**
   * Perform transfer...
   * TODO: ensure returns expected
   *
   * @param {{account: Object, to: String, amount: Number, memo: String, token: String, promptForSignature: Boolean}}
   * @param {Object} testingKeys - If called via unit test, provide this.
   * @memberof PPY
   */
  async transfer({ account, to, amount, memo, token, promptForSignature = true }, testingKeys) {
    const from = account.name;
    const publicActiveKey = account.publicKey;
    const asset = token;

    // Get the transaction
    let transferTransaction = await this.getTransferTransaction(from, to, amount, memo, asset);

    // Sign the transaction
    if (promptForSignature) {
      // transferTransaction = this.signerWithPopup(transferTransaction, account, )
    } else {
      transferTransaction = await this.signer(
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
    transferTransaction = await this.finalize(transferTransaction);

    const callback = () => {
      console.log('callback executing after broadcast');
    };

    // Broadcast the transaction
    await this.broadcast(transferTransaction, callback);
  }
}
