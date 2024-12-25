import { ClientHandler } from '@jackallabs/jackal.js';

/**
 * Initialise le client Jackal et le StorageHandler
 * @returns {Promise<{ client: any, storage: any }>}
 */
export async function initializeJackal() {
  const chainId = 'jackal-1';
  const mainnet = {
    chainId,
    endpoint: 'https://rpc.jackalprotocol.com',
    chainConfig: {
      chainId,
      chainName: 'Jackal Mainnet',
      rpc: 'https://rpc.jackalprotocol.com',
      rest: 'https://api.jackalprotocol.com',
      bip44: { coinType: 118 },
      stakeCurrency: { coinDenom: 'JKL', coinMinimalDenom: 'ujkl', coinDecimals: 6 },
      bech32Config: {
        bech32PrefixAccAddr: 'jkl',
        bech32PrefixAccPub: 'jklpub',
        bech32PrefixValAddr: 'jklvaloper',
        bech32PrefixValPub: 'jklvaloperpub',
        bech32PrefixConsAddr: 'jklvalcons',
        bech32PrefixConsPub: 'jklvalconspub',
      },
      currencies: [{ coinDenom: 'JKL', coinMinimalDenom: 'ujkl', coinDecimals: 6 }],
      feeCurrencies: [{
        coinDenom: 'JKL',
        coinMinimalDenom: 'ujkl',
        coinDecimals: 6,
        gasPriceStep: { low: 0.002, average: 0.002, high: 0.02 },
      }],
      features: [],
    },
  };

  const setup = {
    selectedWallet: 'keplr', // Remplacez par le portefeuille souhaité
    ...mainnet,
  };

  try {
    // Connectez-vous au client
    const client = await ClientHandler.connect(setup);
    
    // Créez un gestionnaire de stockage
    const storage = await client.createStorageHandler();
    
    // Chargez le pool de fournisseurs disponibles
    await storage.loadProviderPool();

    return { client, storage };
  } catch (error) {
    console.error('Error initializing Jackal client:', error);
    throw error;
  }
}
