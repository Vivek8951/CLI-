import React, { useState } from 'react';
import { HardDrive } from 'lucide-react';
import PurchaseStorage from './PurchaseStorage';

interface Provider {
  id: string;
  name: string;
  wallet_address: string;
  available_storage: number;
  price_per_gb: number;
  updated_at: string;
}

interface ProviderCardProps {
  provider: Provider;
}

export default function ProviderCard({ provider }: ProviderCardProps) {
  const [showPurchase, setShowPurchase] = useState(false);
  const lastUpdateTime = new Date(provider.updated_at).getTime();
  const currentTime = Date.now();
  const isRecentlyActive = lastUpdateTime > currentTime - 30 * 1000; // 30 seconds threshold
  const isOnline = isRecentlyActive && provider.is_active; // Consider both timestamp and active status

  const handlePurchaseComplete = () => {
    setShowPurchase(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <HardDrive className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
          </div>
          <span
            className={`text-xs font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}
          >
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Available Storage:</span>
            <span className="font-medium text-gray-900">{provider.available_storage} GB</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Price per GB:</span>
            <span className="font-medium text-gray-900">{provider.price_per_gb} AAI</span>
          </div>
        </div>

        <button
          onClick={() => setShowPurchase(true)}
          disabled={!isOnline}
          className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            isOnline
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Purchase Storage
        </button>
      </div>

      {showPurchase && (
        <div className="border-t border-gray-200">
          <PurchaseStorage
            provider={provider}
            onPurchaseComplete={handlePurchaseComplete}
          />
        </div>
      )}
    </div>
  );
}