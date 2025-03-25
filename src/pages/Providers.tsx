import React, { useEffect, useState } from 'react';
import { HardDrive, Star, ArrowUpRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PurchaseStorage from '../components/PurchaseStorage';
import { useWallet } from '../lib/WalletContext';

interface Provider {
  id: string;
  name: string;
  wallet_address: string;
  available_storage: number;
  price_per_gb: number;
  ipfs_node_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

function ProviderCard({ provider, onPurchase }: { provider: Provider; onPurchase: (provider: Provider) => void }) {
  const lastUpdateTime = new Date(provider.updated_at).getTime();
  const currentTime = Date.now();
  const isRecentlyActive = lastUpdateTime > currentTime - 30 * 1000; // 30 seconds threshold
  const isOnline = isRecentlyActive && provider.is_active && provider.available_storage > 0 && provider.ipfs_node_id;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 rounded-lg">
            <HardDrive className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
            <p className="text-sm text-gray-500">{provider.wallet_address}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${isOnline ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-gray-500">Available Storage</p>
          <p className="text-lg font-semibold text-gray-900">{provider.available_storage} GB</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Price</p>
          <p className="text-lg font-semibold text-gray-900">{provider.price_per_gb} AAI/GB</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400 fill-current" />
          <span className="text-sm font-medium text-gray-700">New Provider</span>
        </div>
        <button 
          onClick={() => onPurchase(provider)}
          disabled={!isOnline}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Purchase Storage
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Providers() {
  const { isConnected, error: walletError } = useWallet();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [sortBy, setSortBy] = useState('price');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      setIsLoading(false);
      return;
    }

    const fetchProviders = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const { data, error } = await supabase
          .from('storage_providers')
          .select('*');

        if (error) {
          console.error('Error fetching providers:', error);
          setError('Failed to load providers. Please try again.');
          return;
        }

        setProviders(data || []);
      } catch (err) {
        console.error('Failed to fetch providers:', err);
        setError('Failed to load providers. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProviders();

    const subscription = supabase
      .channel('storage_providers')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'storage_providers' }, 
        () => fetchProviders()
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to provider updates');
        }
      });

    const intervalId = setInterval(fetchProviders, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, [isConnected]);

  const sortedProviders = [...providers].sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return a.price_per_gb - b.price_per_gb;
      case 'storage':
        return b.available_storage - a.available_storage;
      default:
        return 0;
    }
  });

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Connect Your Wallet</h2>
          <p className="text-gray-600">Please connect your wallet to view available storage providers</p>
        </div>
      </div>
    );
  }

  if (walletError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Wallet Error</h2>
          <p className="text-gray-600">{walletError}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Providers</h2>
          <p className="text-gray-600">Please wait while we fetch available storage providers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Providers Available</h2>
          <p className="text-gray-600">There are currently no storage providers available. Please check back later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Available Providers</h2>
          <p className="text-sm text-gray-500">Choose a provider to store your files</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
          >
            <option value="price">Sort by: Price</option>
            <option value="storage">Sort by: Available Storage</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedProviders.map((provider) => (
          <ProviderCard 
            key={provider.id} 
            provider={provider} 
            onPurchase={setSelectedProvider}
          />
        ))}
      </div>

      {selectedProvider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl max-w-md w-full">
            <button
              onClick={() => setSelectedProvider(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
            <PurchaseStorage 
              provider={selectedProvider} 
              onPurchaseComplete={() => {
                setSelectedProvider(null);
                // Refresh providers list
                supabase
                  .from('storage_providers')
                  .select('*')
                  .then(({ data }) => data && setProviders(data));
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Providers;