import { DesmosClient, DesmosChains, SigningMode, GasPrice } from "@desmoslabs/desmjs";
import { KeplrSigner } from "@desmoslabs/desmjs-keplr";

// Connection to Keplr, return the wallet informations
async function Keplr() {
  if (window.keplr === undefined) {
    throw new Error("Please install the Keplr extention");
  }

  const chainId = "desmos-mainnet-1";

  const signer = new KeplrSigner(window.keplr, {
    signingMode: SigningMode.DIRECT,
    chainInfo: DesmosChains.mainnet
  });

  await signer.connect();

  const keyInfo = await window.keplr.getKey(chainId);

  if (keyInfo.isNanoLedger) {
    throw new Error("Keplr + Ledger is currently not supported");
  }

  const client = await DesmosClient.connectWithSigner("https://rpc.mainnet.desmos.network", signer, {
    gasPrice: GasPrice.fromString("0.01udsm")
  });

  return client;
}

export default Keplr;