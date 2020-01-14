'use strict';

import Account from "@walletpack/core/lib/models/Account";
import Network from "@walletpack/core/lib/models/Network";
import Keypair from "@walletpack/core/lib/models/Keypair";
import {Blockchains} from "@walletpack/core/lib/models/Blockchains";
import Token from "@walletpack/core/lib/models/Token";
import { ResolvePlugin } from "webpack";

const peerplays = new (require('../lib/peerplays').default)();

const keypair = Keypair.fromJson({
	name:'Testing key',
	publicKeys:[{blockchain:Blockchains.PPY, key:'PPY74mnbzYG9WRVL9NQM39LQZw6sJ9WQguqp4kJm8NcQ8tGhXNa2r'}],
	privateKey:'...'
})
const network = Network.fromJson({
	"name":"Peerplays Mainnet",
	"host":"seed01.eifos.org",
	"port":7777,
	"protocol":"https",
	"chainId":"6b6b5f0ce7a36d323768e534f3edb41c6d6332a541a95725b98e28d140850134"
})

const account = Account.fromJson({
	keypairUnique:keypair.unique(),
	networkUnique:network.unique(),
	publicKey:keypair.publicKeys[0].key,
	name: 'eifos-witness'
});


const token = Token.fromJson({
	// contract:'TCN77KWWyUyi2A4Cu7vrh5dnmRyvUuME1E',
	blockchain:Blockchains.PPY,
	symbol:'PPY',
	decimals:5,
	chainId:network.chainId
})

// Removing need for StoreService's state
account.network = () => network;
account.sendable = () => account.publicKey;

describe('peerplays', () => {
    it('should be able to establish a connection', done => {
    	new Promise(async() => {
			peerplays.init();
			done();
	    })
    });
});

// describe('peerplays', () => {
//     it('should be able to retrieve balance', done => {
//     	new Promise(async() => {
// 			await peerplays.init();
// 			const balances = await peerplays.balanceFor(account, 'PPY');
// 			console.log('balances', balances);
//     		done();
// 	    })
//     });
// });

