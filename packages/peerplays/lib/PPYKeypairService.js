import crypto from 'crypto';
import Keypair from '@walletpack/core/models/Keypair';
import _PPY from "./_PPY";

/**
 * Convert a WIF key to its public key string.
 *
 * @param {String} wif
 * @returns {String} publicKey
 */
function getPublicKeyString(wif, prefix = 'PPY') {
  return _PPY.privateFromWif(wif).toPublicKey().toPublicKeyString(prefix);
}

export default class PPYKeypairService {
  /**
   * Generate a new Scatter KeyPair with a "master" key set as the KeyPair.privateKey.
   * The "master" key is an encoded dataset containing all WIFs for all authentication levels for a Peerplays account.
   *
   * @static
   * @param {{owner: String, active: String, memo: String}} wifs - An object containing all Wallet Import Format (WIF) keys associated with a Peerplays acocunt.
   * @param {String} prefix - The chain prefix to use. Important for correct key generation.
   * @returns {Object} - Instance of Scatter Keypair
   * @memberof PPYKeypairService
   */
  static newKeypair(wifs, prefix) {
    const keypair = Keypair.placeholder();
    const blockchain = 'ppy';
    
    // Get the private active key as public key
    const privActive = getPublicKeyString(wifs.active, prefix);

    // Encode they WIF keys and treat the result as a "master" key that other keys can be derived from.
    keypair.privateKey = Buffer.from(JSON.stringify(wifs)).toString('hex')
    keypair.blockchains = [blockchain];
    
    // Here we are storing the secret which doubles as the decrypt seed later for the Scatter UI.
    keypair.publicKeys = [{key: privActive, blockchain: blockchain}]

    return keypair;
  }

  /**
   * Decodes the KeyPair.privateKey returned from PPYKeyPairService.newKeypair(...) into the three authority Wallet Import Format (WIF) keys for a Peerplays account.
   *
   * @static
   * @param {String} encoded - Encoded WIF keys object, the Keypair.privateKey.
   * @returns {{owner: String, active: String, memo: String}} wifs
   * @memberof PPYKeypairService
   */
  static getWifs(encoded) {
    const wifs = JSON.parse(Buffer.from(encoded, 'hex').toString())

    if (!wifs.owner || !wifs.active || !wifs.memo) {
      throw new Error('getWifs: Invalid encoded data provided')
    }
    return wifs;
  }
}
