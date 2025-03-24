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

// Alpha AI Token Contract
export const AAI_TOKEN_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

// Storage Contract
export const STORAGE_CONTRACT_ADDRESS = import.meta.env.VITE_STORAGE_CONTRACT_ADDRESS;

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