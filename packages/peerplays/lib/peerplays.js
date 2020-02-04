import Plugin from '@walletpack/core/plugins/Plugin';
import * as PluginTypes from '@walletpack/core/plugins/PluginTypes';
import * as Actions from '@walletpack/core/models/api/ApiActions';
import { Blockchains } from '@walletpack/core/models/Blockchains';
import Network from '@walletpack/core/models/Network';
import KeyPairService from '@walletpack/core/services/secure/KeyPairService';
import Token from '@walletpack/core/models/Token';
import HardwareService from '@walletpack/core/services/secure/HardwareService';
import StoreService from '@walletpack/core/services/utility/StoreService';
import TokenService from '@walletpack/core/services/utility/TokenService';
import EventService from '@walletpack/core/services/utility/EventService';
import SigningService from '@walletpack/core/services/secure/SigningService';
import ecc from 'eosjs-ecc';
import BigNumber from 'bignumber.js';
const fetch = require('node-fetch');

import {
  Aes,
  Apis,
  ChainValidation,
  ChainStore,
  Login,
  ops,
  PublicKey,
  TransactionBuilder,
  TransactionHelper
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
  BROADCAST: 'broadcast_transaction_with_callback',
};

const roles = ['owner', 'active', 'memo'];

const MAINNET_CHAIN_ID = '6b6b5f0ce7a36d323768e534f3edb41c6d6332a541a95725b98e28d140850134'; // alice
const TESTNET_CHAIN_ID = 'b3f7fe1e5ad0d2deca40a626a4404524f78e65c3a48137551c33ea4e7c365672'; // beatrice

const MAINNET_ENDPOINT_1 = 'https://pma.blockveritas.co/ws';
const MAINNET_FAUCET = 'https://faucet.peerplays.download/faucet';
const PREFIX = 'PPY';

let isLegacy = false;
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
    return `${account.publicKey}`;
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

  async getChainId(network) {
    return 1;
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

  privateToPublic(privateKey, prefix = null) {
    return ecc
      .PrivateKey(privateKey)
      .toPublic()
      .toString(prefix ? prefix : 'PPY');
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
    return ecc.PrivateKey.fromBuffer(Buffer.from(buffer)).toString();
  }

  hexPrivateToBuffer(privateKey) {
    return new ecc.PrivateKey(privateKey).toBuffer();
  }

  hasUntouchableTokens() {
    return false;
  }

  async defaultDecimals(assetId) {
    const asset = await this.getAsset(assetId);
    return asset.precision || 5;
  }

  async defaultToken() {
    return new Token(
      Blockchains.PPY,
      'ppy',
      'PPY',
      'PPY',
      await this.defaultDecimals('1.3.0'),
      MAINNET_CHAIN_ID
    );
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
    let fullAccount = await this.getFullAccount(account.name);
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
    let fullAccount = await this.getFullAccount(account.name);
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

  async signer(payload, publicKey, arbitrary = false, isHash = false, privateKey = null) {
    if (!privateKey) privateKey = await KeyPairService.publicToPrivate(publicKey);
    if (!privateKey) return;

    if (typeof privateKey !== 'string') privateKey = this.bufferToHexPrivate(privateKey);

    if (arbitrary && isHash) return ecc.Signature.signHash(payload.data, privateKey).toString();
    return ecc.sign(Buffer.from(arbitrary ? payload.data : payload.buf, 'utf8'), privateKey);
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
  async _callChain(method, params) {
    const fetchBody = JSON.stringify({
      "method": "call",
      "params": [
        "database",
        method,
        params
      ],
      "jsonrpc": "2.0",
      "id": 1
    });

    return await fetch(MAINNET_ENDPOINT_1, {
      body: fetchBody,
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-type': 'application/json'
      }
    }).catch(err => {
      throw new Error(err);
    }).then(res => res.json()).then(res => res.result);
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
    return await this._callChain(methods.GET_OBJECTS, [objIds]);
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
    return await this._callChain(methods.GET_REQUIRED_FEES, [[ops], assetId]);
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

    let promises = [await this.getRequiredFees(operations, assetId)];

    if (assetId !== '1.3.0') {
      // This handles the fallback to paying fees in BTS if the fee pool is empty.
      promises.push(await this.getRequiredFees(operations, '1.3.0'));
      promises.push(await this.getObjects('1.3.0'));
    }

    return Promise.all(promises).then(res => {
      let [fees, coreFees, asset] = res,
        dynamicPromise;
      asset = asset ? asset[0] : null;

      dynamicPromise =
        assetId !== '1.3.0' && asset
          ? this.getObjects(asset.dynamic_asset_data_id)
          : new Promise(resolve => resolve());

      return dynamicPromise.then(dynamicObject => {
        if (assetId !== '1.3.0') {
          feePool = dynamicObject ? dynamicObject[0].fee_pool : 0;
          let totalFees = 0;

          for (let j = 0, fee; j < coreFees.length; j++) {
            fee = coreFees[j];
            totalFees += fee.amount;
          }

          if (totalFees > parseInt(fee_pool, 10)) {
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
          }

          assetIndex++;

          if (operation.proposed_ops) {
            let result = [];

            for (let y = 0; y < operation.proposed_ops.length; y++) {
              result.push(set_fee(operation.proposed_ops[y].op[1]));
            }

            return result;
          }
        };

        for (let i = 0; i < operations.length; i++) {
          setFee(operations[i][1]);
        }

        return operations[0][1];
      });
    });
  }

  /**
   * TODO: incomplete. Need to handle getting sig
   * Construct a transaction for a transfer operation with correct fees.
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
  async getTransferTransaction(from, to, amount, memo, asset, proposeAccount = null, encryptMemo = true) {
    let feeAssetId = asset;
    if (!from || !to || !amount || !asset) {
      throw new Error('transfer: Missing inputs');
    }

    // TODO ============================================== // TODO
    // ------ get the memo private key from scatter ------//
    // const memoPrivateKey = PrivateKey.fromBuffer(memoPrivateKeyBuffer);
    // const memoPublicKey = memoPrivateKey.toPublicKey().toPublicKeyString();
    // TODO ============================================== // TODO

    let memoToPublicKey;
    // get account data for `from`, `to`, & `proposeAccount`
    const [chainFrom, chainTo] = [await this.getFullAccount(from), await this.getFullAccount(to)];
    const chainProposeAccount = proposeAccount && (await this.getFullAccount(proposeAccount));

    // get asset data
    let chainAsset = await this.getAsset(asset);

    //====================================================================================================
    // console.log(chainFrom, chainTo, chainProposeAccount);
    // console.log(chainAsset, chainFeeAsset);
    // console.log(chainTo.active.key_auths[0][0]);

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

    //=======================================
    const username = 'sample'
    const pw = 'sample-password'
    const { privKeys, pubKeys } = Login.generateKeys(username, pw, roles, PREFIX); // TODO: use stored keys passed from scatter encrypted key storage
    // console.log(privKeys, pubKeys)
    // memoToPublicKey = '';
    const memoPrivateKey = privKeys.memo;
    const memoPublicKey = pubKeys.memo;
    //=======================================
    if (memo && memoToPublicKey && memoPublicKey) {
      let nonce = optional_nonce == null ? TransactionHelper.unique_nonce_uint64() : optional_nonce;

      memoObject = {
        from: memoPublicKey, // From Public Key
        to: memoToPublicKey, // To Public Key
        nonce,
        message: encryptMemo
          ? Aes.encrypt_with_checksum(
              memoPrivateKey, // From Private Key
              memoToPublicKey, // To Public Key
              nonce,
              memo
            )
          : Buffer.isBuffer(memo)
          ? memo.toString('utf-8')
          : memo,
      };
    }

    // console.log(memo_object) =============================================================

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
    return await this.setRequiredFees('1.3.0', tr).then(tr => tr);
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
    roles.forEach(role => {
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
   * Perform transfer...
   * TODO: ensure returns expected
   *
   * @param {{from: String, to: String, amount: Number, memo: String, token: String, promptForSignature: Boolean}}
   * @memberof PPY
   */
  async transfer({from, to, amount, memo, token, promptForSignature = true}) {
    const asset = token;
    // Get the transaction
    const transferTransaction = await this.getTransferTransaction(from, to, amount, memo, asset);
    // return ???
  }

  /**
   * peerplaysjs-lib.Login will generate keys from provided data and compare them with the ones pulled from the
   * Peerplays blockchain (`userPubKeys`).
   *
   * @param {String} username - The login username to associate with the account to be registered.
   * @param {String} password - The login password to associate with the account to be registered.
   * @param {String} prefix - Optional prefix.
   * @returns {Boolean}
   */
  async authUser(username, password, prefix = 'PPY') {
    // Ensure the Login class has the correct roles configured.
    Login.setRoles(roles);

    const userPubKeys = await this.getAccountKeys(username);

    const user = {
      accountName: username,
      password,
      auths: userPubKeys,
    };

    // TODO: modify this such that the Scatter UI has the data it requires to import an existing account. Likely will require to generate keys and return them to something
    const authed = Login.checkKeys(user, prefix);

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
    Login.setRoles(roles);
    let keys = Login.generateKeys(username, password, roles, PREFIX);
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
    return await fetch(MAINNET_FAUCET, {
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
}
