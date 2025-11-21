import { ClientHandler } from "@jackallabs/jackal.js";

let cachedClient = null, cachedStorage = null;

export async function initializeJackal() {
  if (cachedClient && cachedStorage) return { client: cachedClient, storage: cachedStorage };

  const chainId = "jackal-1";
  const mainnet = {
    chainId,
    endpoint: "https://rpc.jackalprotocol.com",
    chainConfig: {
      chainId, chainName: "Jackal Mainnet", rpc: "https://rpc.jackalprotocol.com", rest: "https://api.jackalprotocol.com",
      bip44: { coinType: 118 },
      stakeCurrency: { coinDenom: "JKL", coinMinimalDenom: "ujkl", coinDecimals: 6 },
      bech32Config: { bech32PrefixAccAddr: "jkl", bech32PrefixAccPub: "jklpub", bech32PrefixValAddr: "jklvaloper", bech32PrefixValPub: "jklvaloperpub", bech32PrefixConsAddr: "jklvalcons", bech32PrefixConsPub: "jklvalconspub" },
      currencies: [{ coinDenom: "JKL", coinMinimalDenom: "ujkl", coinDecimals: 6 }],
      feeCurrencies: [{ coinDenom: "JKL", coinMinimalDenom: "ujkl", coinDecimals: 6, gasPriceStep: { low: 0.002, average: 0.002, high: 0.02 } }],
      features: [],
    },
  };

  try {
    const client = await ClientHandler.connect({ selectedWallet: "keplr", ...mainnet });
    const storage = await client.createStorageHandler();
    await storage.loadProviderPool();
    cachedClient = client;
    cachedStorage = storage;
    return { client, storage };
  } catch (error) {
    console.error("Error initializing Jackal client:", error);
    throw error;
  }
}
