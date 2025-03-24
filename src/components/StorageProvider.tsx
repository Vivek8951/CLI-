import React from 'react';
import { HardDrive } from 'lucide-react';

interface StorageProviderProps {
  provider: {
    id: string;
    name: string;
    availableStorage: number;
    pricePerGB: number;
  };
  onSelect: (providerId: string) => void;
}

export function StorageProvider({ provider, onSelect }: StorageProviderProps) {
  return (
    <div className="p-6 bg-white rounded-xl shadow-lg">
      <div className="flex items-center gap-4 mb-4">
        <HardDrive className="w-8 h-8 text-purple-600" />
        <h3 className="text-xl font-semibold">{provider.name}</h3>
      </div>
      <div className="space-y-2 mb-4">
        <p className="text-gray-600">
          Available: {provider.availableStorage} GB
        </p>
        <p className="text-gray-600">
          Price: {provider.pricePerGB} AAI/GB
        </p>
      </div>
      <button
        onClick={() => onSelect(provider.id)}
        className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        Select Provider
      </button>
    </div>
  );
}