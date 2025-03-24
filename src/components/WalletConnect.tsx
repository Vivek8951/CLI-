import React, { useState, useEffect } from 'react';
import { Wallet, LogOut } from 'lucide-react';
import { connectWallet } from '../lib/web3';

export function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    // Check if wallet is already connected
    const checkConnection = async () => {
      if (typeof window !== 'undefined' && 'ethereum' in window) {
        const ethereum = (window as any).ethereum;
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
        } else {
          // Auto-connect to the specified wallet address
          const targetAddress = '0xd5F6a56c8B273854fbd135239FcbcC2B8142585a';
          try {
            await ethereum.request({
              method: 'eth_requestAccounts',
              params: [{ eth_accounts: [targetAddress] }]
            });
            setAddress(targetAddress);
          } catch (error) {
            console.error('Failed to auto-connect wallet:', error);
          }
        }
      }
    };
    checkConnection();

    // Listen for account changes
    if (typeof window !== 'undefined' && 'ethereum' in window) {
      const ethereum = (window as any).ethereum;
      ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0]);
        } else {
          setAddress(null);
        }
      });
    }
  }, []);

  const handleConnect = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('Please install MetaMask to use this application');
      }

      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Switch to BSC Testnet
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x61' }] // BSC Testnet chainId
        });
      } catch (switchError: any) {
        // If BSC Testnet is not added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x61',
              chainName: 'BSC Testnet',
              nativeCurrency: {
                name: 'BNB',
                symbol: 'tBNB',
                decimals: 18
              },
              rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
              blockExplorerUrls: ['https://testnet.bscscan.com']
            }]
          });
        } else {
          throw new Error('Please switch to BSC Testnet');
        }
      }

      setAddress(accounts[0]);
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  };

  const handleDisconnect = async () => {
    try {
      const ethereum = (window as any).ethereum;
      await ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }]
      });
      setAddress(null);
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  return (
    <button
      onClick={address ? handleDisconnect : handleConnect}
      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
    >
      {address ? <LogOut className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect Wallet'}
    </button>
  );
}