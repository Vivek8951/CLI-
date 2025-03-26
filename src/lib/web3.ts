import { ethers } from 'ethers';

// BSC Testnet configuration
export const BSC_TESTNET_CONFIG = {
  chainId: '0x61',
  chainName: 'BSC Testnet',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'tBNB',
    decimals: 18,
  },
  rpcUrls: [import.meta.env.VITE_NETWORK_RPC_URL],
  blockExplorerUrls: ['https://testnet.bscscan.com/'],
};

// Alpha AI Token Contract (BSC Testnet)
export const AAI_TOKEN_ADDRESS = '0xd9145CCE52D386f254917e481eB44e9943F39138';

// Storage Contract (BSC Testnet)
export const STORAGE_CONTRACT_ADDRESS = '0xd5F6a56c8B273854fbd135239FcbcC2B8142585a';

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('Please install MetaMask to use this application');
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    // Switch to BSC Testnet
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_TESTNET_CONFIG.chainId }]
      });
    } catch (switchError) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [BSC_TESTNET_CONFIG]
        });
      } else {
        throw switchError;
      }
    }

    return accounts[0];
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    throw error;
  }
}