import Plugin from                      '@walletpack/core/plugins/Plugin';
import * as PluginTypes from            '@walletpack/core/plugins/PluginTypes';
import * as Actions from                '@walletpack/core/models/api/ApiActions';
import {Blockchains} from               '@walletpack/core/models/Blockchains'
import Network from                     '@walletpack/core/models/Network'
import KeyPairService from              '@walletpack/core/services/secure/KeyPairService';
import Token from                       "@walletpack/core/models/Token";
import HardwareService from             "@walletpack/core/services/secure/HardwareService";
import StoreService from                "@walletpack/core/services/utility/StoreService";
import TokenService from                "@walletpack/core/services/utility/TokenService";
import EventService from                "@walletpack/core/services/utility/EventService";
import SigningService from              "@walletpack/core/services/secure/SigningService";
import ecc from 'eosjs-ecc';
import Immutable from 'immutable';
import BigNumber from 'bignumber.js';

import {PrivateKey, PublicKey, ChainValidation, key, ChainStore, ChainConfig, Apis} from "peerplaysjs-lib";
//TO-DO: Replace with Peerplays explorer.
const EXPLORER = {
	"name":"PeerplaysBlockchain",
	"account":"https://peerplaysblockchain.info/account/{x}",
	"transaction":"https://peerplaysblockchain.info/explorer/transactions/{x}",
	"block":"https://peerplaysblockchain.info/block/{x}"
};

const MAINNET_CHAIN_ID = 1;

export default class PPY extends Plugin {

	constructor(){
		 super('ppy', PluginTypes.BLOCKCHAIN_SUPPORT) 
	}

	init(){
		console.log('INIT');
		Apis.instance('wss://api.eifos.org', true).init_promise.then((res) => {
			ChainStore.init().then(() => {
				Apis.instance().db_api().exec( "set_subscribe_callback", [ console.log('set_subscribe_callback update:\n', object), true ] )
			});
		  }).catch((e) => {
			  console.log(e);
		  });
	}

	callBlockchainApi(apiPluginName, methodName, params = []) {
		let apiPlugin;
	
		if (apiPluginName === 'db_api') {
		  apiPlugin = Apis
			.instance()
			.db_api();
	
		  return apiPlugin
			.exec(methodName, params)
			.then((result) => {
			  return Immutable.fromJS(result);
			})
			.catch((err) => {
			  // Intercept and log
			  log.error(`Error in calling ${apiPluginName}\nMethod: ${methodName}\nParams: ${JSON.stringify(params)}\nError: `, err);
			  // Return an empty response rather than throwing an error.
			  return Immutable.fromJS({});
			});
		}
	  }

	callBlockchainDbApi(methodName, params = []) {
		return this.callBlockchainApi('db_api', methodName, params);
	  }

	getFullAccount(accountNameOrId) {
		return this.callBlockchainDbApi('get_full_accounts', [[accountNameOrId], true]).then((result) => {
		  const fullAccount = result.getIn([0, 1]);
		  // Return the full account
		  return fullAccount;
		});
	  }

	  

	bip(){ return `44'/194'/0'/0/`}
	bustCache(){ cachedInstances = {}; }
	defaultExplorer(){ return EXPLORER; }
	accountFormatter(account){ return `${account.publicKey}` }
	returnableAccount(account){
		 return { name:account.name, address:account.publicKey, blockchain:Blockchains.PPY }
		}
	
	// TO-DO:
	contractPlaceholder(){
		 return ''; 
		}

	checkNetwork(network){
		return Promise.race([
			new Promise(resolve => setTimeout(() => resolve(null), 2000)),
			fetch(`${network.fullhost()}/v1/chain/get_info`).then(() => true).catch(() => false),
		])
	}

	getEndorsedNetwork(){
		//TO-DO: Replace with Peerplays mainnet.
		return new Network('Peerplays Mainnet', 'https', 'seed01.eifos.org', 7777, Blockchains.PPY, MAINNET_CHAIN_ID)
	}

	isEndorsedNetwork(network){
		const endorsedNetwork = this.getEndorsedNetwork();
		return network.blockchain === 'ppy' && network.chainId === endorsedNetwork.chainId;
	}

	async getChainId(network){
		return 1;
	}

	usesResources(){ return false; }
	hasAccountActions(){ return false; }

	accountsAreImported(){ return true; }

	isValidRecipient(name){
		 return ChainValidation.is_account_name(name); 
		}
	privateToPublic(privateKey, prefix = null){ return ecc.PrivateKey(privateKey).toPublic().toString(prefix ? prefix : 'PPY'); }
	validPrivateKey(privateKey){ return privateKey.length >= 50 && ecc.isValidPrivate(privateKey); }
	validPublicKey(publicKey, prefix = null){
		try {
			return PublicKey.fromStringOrThrow(publicKey, prefix ? prefix : 'PPY');
		} catch(e){
			return false;
		}
	}
	bufferToHexPrivate(buffer){
		return ecc.PrivateKey.fromBuffer(Buffer.from(buffer)).toString()
	}
	hexPrivateToBuffer(privateKey){
		return new ecc.PrivateKey(privateKey).toBuffer();
	}

	hasUntouchableTokens(){ return false; }

	async balanceFor(account, token){
		let fullAccount = await this.getFullAccount(account.name);
		let unformattedBalance;

		if (token.symbol.toUpperCase() === 'PPY' ) {
			const assetIndex = account.get('balances').findIndex((asset) => asset.get('asset_type') === '1.3.0');
			unformattedBalance = fullAccount.get('balances').get(assetIndex).get('balance')
		} else if (token.symbol.toUpperCase() === 'BTF') {
			const assetIndex = account.get('balances').findIndex((asset) => asset.get('asset_type') === '1.3.1');
			unformattedBalance = fullAccount.get('balances').get(assetIndex).get('balance')
		} else {
			return token;
		}
		const balance = new BigNumber(unformattedBalance)/(Math.pow(10, this.defaultDecimals()));
		const clone = token.clone();
		clone.amount = balance;
		return clone;

	}

	/***
	 * Gets an array of token's values.
	 * The `tokens` param might also be omitted which would mean to grab "all available tokens for an account".
	 * Returns an array of Token class.
	 */
	async balancesFor(account, tokens, fallback = false){
		let fullAccount = await this.getFullAccount(account.name);
		
		tokens.map((token) => {
			const t = token.clone();
			if (token.symbol.toUpperCase() === 'PPY' ) {
				const assetIndex = account.get('balances').findIndex((asset) => asset.get('asset_type') === '1.3.0');
				unformattedBalance = fullAccount.get('balances').get(assetIndex).get('balance');
			} else if (token.symbol.toUpperCase() === 'BTF') {
				const assetIndex = account.get('balances').findIndex((asset) => asset.get('asset_type') === '1.3.1');
				unformattedBalance = fullAccount.get('balances').get(assetIndex).get('balance');
			}
			const balance = new BigNumber(unformattedBalance)/(Math.pow(10, this.defaultDecimals()));
			t.amount = balance;
			return t;
		})


	}

	defaultDecimals(){ return 8; }
	defaultToken(){ return new Token(Blockchains.PPY, 'ppy', 'PPY', 'PPY', this.defaultDecimals(), MAINNET_CHAIN_ID) }
	actionParticipants(payload){ return payload.transaction.participants }


	async transfer({account, to, amount, token, memo, promptForSignature = true}){
		if(!this.isValidRecipient(to)) return {error:'Invalid recipient account name'};
		amount = parseFloat(amount).toFixed(token.decimals);
		const {contract, symbol} = token;
		const amountWithSymbol = amount.indexOf(symbol) > -1 ? amount : `${amount} ${symbol}`;


		return new Promise(async (resolve, reject) => {
			const eos = this.getSignableEosjs(account, reject, promptForSignature);

			const result = await eos.transact({
				actions:[{
					account: contract,
					name:'transfer',
					authorization: [{
						actor: account.sendable(),
						permission: account.authority,
					}],
					data:{
						from: account.name,
						to,
						quantity:amountWithSymbol,
						memo:memo,
					},
				}]
			}, {
				blocksBehind: 3,
				expireSeconds: 30,
			})
				.catch(res => resolve({error:popupError(res)}))
				.then(result => resolve(result))
		})
	}

	async signer(payload, publicKey, arbitrary = false, isHash = false, privateKey = null){
		if(!privateKey) privateKey = await KeyPairService.publicToPrivate(publicKey);
		if (!privateKey) return;

		if(typeof privateKey !== 'string') privateKey = this.bufferToHexPrivate(privateKey);

		if (arbitrary && isHash) return ecc.Signature.signHash(payload.data, privateKey).toString();
		return ecc.sign(Buffer.from(arbitrary ? payload.data : payload.buf, 'utf8'), privateKey);
	}

	async signerWithPopup(payload, account, rejector){
		return new Promise(async resolve => {
			payload.messages = await this.requestParser(payload);
			payload.identityKey = StoreService.get().state.scatter.keychain.identities[0].publicKey;
			payload.participants = [account];
			payload.network = account.network();
			payload.origin = 'Scatter';
			const request = {
				payload,
				origin:payload.origin,
				blockchain:Blockchains.TRX,
				requiredFields:{},
				type:Actions.SIGN,
				id:1,
			}

			EventService.emit('popout', request).then( async ({result}) => {
				if(!result || (!result.accepted || false)) return rejector({error:'Could not get signature'});

				let signature = null;
				if(KeyPairService.isHardware(account.publicKey)){
					signature = await HardwareService.sign(account, payload);
				} else signature = await SigningService.sign(payload.network, payload, account.publicKey);

				if(!signature) return rejector({error:'Could not get signature'});

				resolve(signature);
			}, true);
		})
	}

	async requestParser(payload, network){
		if(payload.transaction.hasOwnProperty('serializedTransaction'))
			return this.parseEosjs2Request(payload, network);
		else return this.parseEosjsRequest(payload, network);
	}

}