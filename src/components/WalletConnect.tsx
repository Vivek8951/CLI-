import React from 'react';
import { Wallet, LogOut } from 'lucide-react';
import { useWallet } from '../lib/WalletContext';

export function WalletConnect() {
  const { address, isConnecting, error, connect, disconnect } = useWallet();

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-600 mr-2">{error}</span>
      )}
      {address ? (
        <button
          onClick={disconnect}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        >
          <LogOut className="w-4 h-4" />
          {address.slice(0, 6)}...{address.slice(-4)}
        </button>
      ) : (
        <button
          onClick={connect}
          disabled={isConnecting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Wallet className="w-4 h-4" />
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      )}
    </div>
  );
}