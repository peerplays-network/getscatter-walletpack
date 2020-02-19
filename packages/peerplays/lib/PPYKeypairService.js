import crypto from 'crypto';
import Keypair from '@walletpack/core/models/Keypair';
import _PPY from "./_PPY";

class CryptoHelper {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    const resizedIV = Buffer.allocUnsafe(16);
    const iv = crypto
      .createHash("sha256")
      .update("myHashedIV")
      .digest();
    iv.copy(resizedIV);
    this.resizedIV = resizedIV;
  }

  /**
   * Encrypt `plainText` with `secret`.
   *
   * @param {String} plainText - The string to be encrypted
   * @param {String} secret - The password that is needed to decrypt/encrypt.
   * @returns
   * @memberof CryptoHelper
   */
  encrypt(plainText, secret) {
    const key = crypto
        .createHash("sha256")
        .update(secret)
        .digest(),
    cipher = crypto.createCipheriv("aes256", key, this.resizedIV);
    let encrypted = '';

    encrypted = cipher.update(plainText, 'binary', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt the private key WIFs from the provided `keypair`.
   *
   * @param {String} priv - Key that is encrypted
   * @param {String} pub - The password that is needed to decrypt/encrypt.
   * @returns {*} json parsed decrypted values.
   * @memberof CryptoHelper
   */
  decrypt(priv, pub) {
    const secret = pub;
    const toDecrypt = priv;

    const key = crypto
        .createHash("sha256")
        .update(secret)
        .digest(),
    decipher = crypto.createDecipheriv("aes256", key, this.resizedIV);
    let decrypted = '';

    decrypted = decipher.update(toDecrypt, 'hex', 'binary');
    decrypted += decipher.final('binary');
    return JSON.parse(decrypted);
  }
}

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
   * The "master" key is an encrypted dataset containing all WIFs for all authentication levels for a Peerplays account.
   * ie:
   * const kp = PPYKeyPairService.newKeyPair(wifs, 'PPY');
   * const wifs = new CryptoHelper().decrypt(keypair);
   *
   * @static
   * @param {{owner: String, active: String, memo: String}} wifs - An object containing all Wallet Import Format (WIF) keys associated with a Peerplays acocunt.
   * @param {String} prefix - The chain prefix to use. Important for correct key generation.
   * @returns
   * @memberof PPYKeypairService
   */
  static newKeypair(wifs, prefix) {
    const ch = new CryptoHelper();
    const keypair = Keypair.placeholder();
    const blockchain = 'ppy';
    
    // Setup the decrypt/encrypt secret which will be the WIF Owner key.
    const secret = getPublicKeyString(wifs.owner, prefix);

    // Encrypt they WIF keys and treat the result as a "master" key that other keys can be derived from.
    keypair.privateKey = ch.encrypt(JSON.stringify(wifs), secret);
    keypair.blockchains = [blockchain];
    
    // Here we are storing the secret which doubles as the decrypt seed later for the Scatter UI.
    keypair.publicKeys = [{key: secret, blockchain: blockchain}]

    return keypair;
  }

  /**
   * Decrypts the KeyPair.privateKey returned from PPYKeyPairService.newKeypair(...) into the three authority WIF keys for a Peerplays account.
   * ie:
   * const kp = PPYKeyPairService.newKeyPair(wifs, 'PPY');
   * const wifs = new CryptoHelper().decrypt(keypair);
   *
   * @static
   * @param {String} priv - Key that is encrypted
   * @param {String} pub - The password that is needed to decrypt/encrypt.
   * @returns {{owner: String, active: String, memo: String}} wifs
   * @memberof PPYKeypairService
   */
  static getWifs(priv, pub) {
    const ch = new CryptoHelper();
    return ch.decrypt(priv, pub);
  }
}