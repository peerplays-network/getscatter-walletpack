import {
  Aes,
  ChainConfig,
  ChainTypes,
  hash,
  Login,
  ops,
  PrivateKey as Pkey,
  Signature,
  TransactionBuilder,
  TransactionHelper,
} from 'peerplaysjs-lib';

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

const MAINNET_ENDPOINT_1 = 'https://pma.blockveritas.co/ws';
const MAINNET_FAUCET = 'https://faucet.peerplays.download/api/v1/accounts';

const TESTNET_ENDPOINT_1 = '';
const TESTNET_FAUCET = '';

const DEFAULT_PREFIX = 'PPY';
const TESTNET_PREFIX = 'TEST';

// Override these for testnets
const ENDPOINT = TESTNET_ENDPOINT_1;
const FAUCET = TESTNET_FAUCET;
const PREFIX = TESTNET_PREFIX;

if (PREFIX !== DEFAULT_PREFIX) {
  ChainConfig.setPrefix(PREFIX);
}

export default class _PPY {
  /**
   * Convert a human readable token/asset amount into a blockchain number (no decimals)
   * ie: `1` is `100000` on chain for an asset/token with precision of 5.
   *
   * @static
   * @param {String||Number} amount
   * @param {Object} token
   * @returns {Number}
   * @memberof _PPY
   */
  static convertToChainAmount(amount, token) {
    if (!amount || !token) {
      throw new Error('convertToChainAmount: Missing inputs')
    }

    return parseFloat(amount) * Math.pow(10, token.decimals);
  }

  /**
   * Fetch the Peerplays blockchain for data.
   *
   * @static
   * @param {String} method - The method associated with the request to be made.
   * @param {Array} params - The parameters associated with the method.
   * @returns {*} - The data from the request OR an error if there is one.
   * @memberof _PPY
   */
  static async callChain(method, params, api = 'database') {
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
   * Convert the provided WIF to its PrivateKey object counterpart.
   *
   * @static
   * @param {Object} privateKeyWif - Private Key in Wallet Import Format (WIF)
   * @returns {Object}
   * @memberof _PPY
   */
  static privateFromWif(privateKeyWif) {
    return Pkey.fromWif(privateKeyWif);
  }

  /**
   * Retrieve the asset information from the Peerplays chain.
   *
   * @static
   * @param {String} assetID - The asset id to request information for ie: '1.3.0'.
   * @returns {Object}
   * @memberof _PPY
   */
  static async getAsset(assetID) {
    if (!assetID) {
      throw new Error('getAsset: Missing inputs');
    }
    const res = await _PPY.callChain(methods.GET_ASSET, [[assetID]]);
    return res[0];
  }

  /**
   * Returns data objects from chain for provided array of object ids.
   * this.getObject(['1.3.0'])
   *
   * @param {Array} objIds - The list of ids to retrieve data from the Peerplays chain.
   * @returns {Array} - An array of the objects requested.
   * @memberof _PPY
   */
  async getObjects(objIds) {
    if (!objIds || objIds.length === 0) {
      throw new Error('getObjects: Missing inputs');
    }
    return await _PPY.callChain(methods.GET_OBJECTS, [[objIds]]);
  }

  /**
   * Request the chain id.
   *
   * @static
   * @returns {String}
   * @memberof _PPY
   */
  static async getChainId() {
    return await this.callChain(methods.GET_CHAIN_ID, []);
  }

  /**
   * Requests from Peerplays blockchain for account data object.
   *
   * @static
   * @param {String} accountNameOrId - The Peerplays account username to request data for.
   * @returns {Object}
   * @memberof _PPY
   */
  static async getFullAccount(accountNameOrId) {
    if (!accountNameOrId) {
      throw new Error('getFullAccount: Missing input');
    }
    const res = await this.callChain(methods.GET_FULL_ACCOUNTS, [[accountNameOrId], true]);
    return res[0][1].account;
  }

  /**
   * Requests from Peerplays blockchain for full object.
   *
   * @static
   * @param {String} accountNameOrId - The Peerplays account username to request data for.
   * @returns {Object}
   * @memberof _PPY
   */
  static async getFullAccountObject(accountNameOrId) {
    if (!accountNameOrId) {
      throw new Error('getFullAccount: Missing input');
    }
    const res = await this.callChain(methods.GET_FULL_ACCOUNTS, [[accountNameOrId], true]);
    return res[0][1];
  }

  /**
   * Used by setRequiredFees.
   *
   * @static
   * @param {Array} ops - The operations within a TransactionBuilder instance.
   * @param {String} assetId - The id of the asset to use ie: '1.3.0'.
   * @returns {Array} - An array of objects containing the fees associated with the provided `ops`.
   * @memberof _PPY
   */
  static async getRequiredFees(ops, assetId) {
    if (!ops || !assetId) {
      throw new Error('getRequiredFees: Missing inputs');
    }
    return await _PPY.callChain(methods.GET_REQUIRED_FEES, [ops, assetId]);
  }

  /**
   * Get the requires fees associated with an operation.
   *
   * @param {String} opToPrice
   * @returns {Object} fees
   * @memberof _PPY
   */
  async getFees(opToPrice) {
    if (!opToPrice) {
      throw new Error('getFee: Missing inputs');
    }

    const op = ChainTypes.operations[opToPrice];

    if (op === undefined) {
      throw new Error('getFee: No operation matching request');
    }

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
   * @static
   * @param {String} assetId
   * @param {Object} tr - The instance of TransactionBuilder associated with the transaction requiring fees to be set.
   * @returns {Object} - The transaction that was passed in with the fees set on the operations within it.
   * @memberof _PPY
   */
  static async setRequiredFees(assetId, tr) {
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
   * @static
   * @param {String} accountNameOrId - ie: 'mcs' || '1.2.26'
   * @returns {Array} keys - [ownerPublicKey, activePublicKey, memoPublicKey]
   * @memberof _PPY
   */
  static async getAccountKeys(accountNameOrId) {
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
   * @static
   * @param {String} username - The login username to associate with the account to be registered.
   * @param {String} password - The login password to associate with the account to be registered.
   * @returns {Boolean}
   * @memberof _PPY
   */
  static async authUser(username, password) {
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
   * @static
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
   * @memberof _PPY
   */
  static async register(attempt, username, password, referral = null) {
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
   * Build the required memo object for a Peeprlays transfer operation.
   *
   * @static
   * @param {string} memo
   * @param {string} memoWif
   * @param {string} recipient
   * @param {boolean} [encryptMemo=true]
   * @param {*} [optional_nonce=null]
   * @returns
   * @memberof _PPY
   */
  static async buildMemo(memo, memoWif, recipient, encryptMemo = true, optional_nonce = null) {
    if (!memo || !memoWif) {
      throw new Error('buildMemo: Missing inputs');
    }

    let memoToPublicKey;

    // get account data for `from`, and `to`
    const chainTo = await this.getFullAccount(recipient);

    // If we have a non-empty string memo and are configured to encrypt...
    if (encryptMemo) {
      memoToPublicKey = chainTo.options.memo_key;

      // Check for a null memo key, if the memo key is null use the receivers active key
      if (/PPY1111111111111111111111111111111114T1Anm/.test(memoToPublicKey)) {
        memoToPublicKey = chainTo.active.key_auths[0][0];
      }
    }

    const memoPrivateKey = this.privateFromWif(memoWif);
    const memoPublicKey = memoPrivateKey.toPublicKey().toPublicKeyString(PREFIX);

    let memoObject;

    if (memoToPublicKey && memoPublicKey) {
      let nonce = optional_nonce == null ? TransactionHelper.unique_nonce_uint64() : optional_nonce;

      memoObject = {
        from: memoPublicKey, // From Public Key
        to: memoToPublicKey, // To Public Key
        nonce,
        message: Aes.encrypt_with_checksum(
          memoPrivateKey, // From Private Key
          memoToPublicKey, // To Public Key
          nonce,
          memo
        ),
      };
    }

    return memoObject;
  }

  /**
   * Construct a pseudo unsigned transaction for a transfer operation without fees.
   * The return value of this function is not a complete transaction.
   *
   * @static
   * @param {String} from - The sending Peerplays account name.
   * @param {String} to - The recipient Peerplays account name.
   * @param {Number} amount - The numerical amount of funds to send to the recipient.
   * @param {String} memo - The optional message to send along with the funds being transferred.
   * @param {String} asset - The Peerplays asset (User Issued Asset token) id associated with the transfer.
   * @returns {TransactionBuilder} - A TransactionBuilder transaction instance with fees set on the transaction for a transfer operation.
   * @memberof _PPY
   */
  static async getTransferTransaction(from, to, amount, memo, asset) {
    let feeAssetId = asset;
    if (!from || !to || !amount || !asset) {
      throw new Error('transfer: Missing inputs');
    }

    // Get account data
    const [chainFrom, chainTo] = [await this.getFullAccount(from), await this.getFullAccount(to)];

    // get asset data
    let chainAsset = await this.getAsset(asset);

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

    let transferOp = {
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
      memo: {
        from: PREFIX,
        to: '',
        nonce: 0,
        message: ''
      },
    };

    tr.op = transferOp;
    tr.recipient = to; // assign temp recipient prop for use later when building the memo.
    tr.message = memo; // assign temp message prop for use later when building the memo.

    // Return the unfinished transaction. Fee setting, finalizing, serialization: occur elsewhere within peerplays.js
    return tr;
  }

  /**
   * Finalize transaction.
   *
   * @static
   * @param {Object} tr - TransactionBuilder instance.
   * @returns {Object} - tr
   * @memberof _PPY
   */
  static async finalize(tr) {
    if (tr.signer_private_keys.length < 1) {
      throw new Error('not signed');
    }

    if (tr.tr_buffer) {
      throw new Error('already finalized');
    }

    const obj210 = await this.callChain(methods.GET_OBJECTS, [['2.1.0']]);
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

      // let _type = ops.operation.st_operations[op[0]];
      // let hexBuffer = _type.toBuffer(op[1]).toString('hex');
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
   * @static
   * @param {Object} tr
   * @param {String} chainId
   * @returns {Object} transaction
   * @memberof _PPY
   */
  static async sign(tr, chainId) {
    if (!tr || !chainId) {
      throw new Error('sign: Missing inputs');
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
   * @static
   * @param {Object} tr - The transaction to broadcast.
   * @param {*} was_broadcast_callback - The callback to execute once successfully broadcasted.
   * @returns {Function||Error} was_broadcast_callback||new Error(...)
   * @memberof _PPY
   */
  static async broadcast(tr, was_broadcast_callback) {
    if (!tr || !was_broadcast_callback) {
      throw new Error('_broadcast: Missing inputs');
    }

    if (tr.signatures.length < 1) {
      const chainId = await this.getChainId();
      tr = await this.sign(tr, chainId);
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

    return this.callChain(methods.BROADCAST, [res => res, tr_object], 'network_broadcast')
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
}