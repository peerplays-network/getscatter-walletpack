import PluginRepository from "../../plugins/PluginRepository";
import KeyPairService from "./KeyPairService";
import HardwareService from "./HardwareService";

let signer;
export default class SigningService {

	static init(_signer){
		signer = _signer;
	}

	static sign(network, payload, publicKey, arbitrary = false, isHash = false){
		console.log(signer);
		// payload, publicKey, arbitrary = false, isHash = false, account = null
		if(!signer){
			console.log('!signer');
			if(KeyPairService.isHardware(publicKey)){
				return HardwareService.sign(network, publicKey, payload);
			} else return PluginRepository.plugin(network.blockchain).signer(payload, publicKey, arbitrary, isHash);
		} else {
			console.log('use injected signer');
			return signer(network, publicKey, payload, arbitrary, isHash);
		} 
	}

}