import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ethers } from 'ethers';
import { AAI_TOKEN_ADDRESS, STORAGE_CONTRACT_ADDRESS } from '../lib/web3';

interface StorageProvider {
  id: string;
  name: string;
  wallet_address: string;
  available_storage: number;
  price_per_gb: number;
}

interface PurchaseStorageProps {
  provider: StorageProvider;
  onPurchaseComplete: () => void;
}

export default function PurchaseStorage({ provider, onPurchaseComplete }: PurchaseStorageProps) {
  const [storageAmount, setStorageAmount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // BSC Testnet token contract address
const BSC_TOKEN_ADDRESS = '0xd5F6a56c8B273854fbd135239FcbcC2B8142585a';

  const handlePurchase = async () => {
    try {
      setIsLoading(true);

      // Check if wallet is connected
      if (!(window as any).ethereum) {
        throw new Error('Please connect your wallet first');
      }

      // Initialize blockchain transaction with BNB Test network
      const bscProvider = new ethers.BrowserProvider((window as any).ethereum, {
        name: "BNB Test Network",
        chainId: 97,
        ensAddress: null // Explicitly disable ENS resolution
      });
      const network = await bscProvider.getNetwork();
      
      // Ensure we're on BNB Test network (Chain ID: 97)
      if (network.chainId !== 97n) {
        // Request network switch if not on BNB Test
        try {
          await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x61' }] // 0x61 is hex for 97
          });
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            try {
              await (window as any).ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x61',
                  chainName: 'BNB Test Network',
                  nativeCurrency: {
                    name: 'BNB',
                    symbol: 'tBNB',
                    decimals: 18
                  },
                  rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545'],
                  blockExplorerUrls: ['https://testnet.bscscan.com']
                }]
              });
            } catch (addError) {
              throw new Error('Failed to add BNB Test network to your wallet');
            }
          }
          throw new Error('Please switch to BNB Test network');
        }
      }
      
      const signer = await bscProvider.getSigner();
      const userAddress = await signer.getAddress();

      // Calculate total cost in AAI tokens
      const totalCost = storageAmount * provider.price_per_gb;

      // Check if provider is active and has IPFS node
      const { data: providerData, error: providerError } = await supabase
        .from('storage_providers')
        .select('is_active, available_storage, ipfs_node_id, updated_at')
        .eq('id', provider.id)
        .single();

      if (providerError) {
        throw new Error('Failed to verify provider status: ' + providerError.message);
      }

      if (!providerData) {
        throw new Error('Provider not found');
      }

      const lastUpdateTime = new Date(providerData.updated_at).getTime();
      const currentTime = Date.now();
      const isRecentlyActive = lastUpdateTime > currentTime - 30 * 1000; // 30 seconds threshold

      if (!providerData.is_active || !isRecentlyActive) {
        throw new Error('Storage provider is currently offline or not responding');
      }

      if (!providerData.ipfs_node_id) {
        throw new Error('Storage provider has no IPFS node configured');
      }

      if (providerData.available_storage < storageAmount) {
        throw new Error('Insufficient storage available from this provider');
      }

      // Get the AAI token contract with complete ABI
      // Validate token address with proper checksum
      const validTokenAddress = ethers.getAddress(BSC_TOKEN_ADDRESS.toLowerCase());
      const tokenContract = new ethers.Contract(
        validTokenAddress,
        [
          "function approve(address spender, uint256 value) returns (bool)",
          "function balanceOf(address account) view returns (uint256)",
          "function transfer(address to, uint256 value) returns (bool)",
          "function decimals() view returns (uint8)",
          "function allowance(address owner, address spender) view returns (uint256)"
        ],
        signer
      );

      // Initialize storage contract with proper error handling and complete ABI
      if (!STORAGE_CONTRACT_ADDRESS) {
        throw new Error('Storage contract address not configured');
      }

      // Validate storage contract address with proper checksum
      const validStorageAddress = ethers.getAddress(STORAGE_CONTRACT_ADDRESS.toLowerCase());
      const storageContractABI = [
        "function purchaseStorage(address provider, uint256 storageAmount, uint256 tokenAmount, uint256 duration) external returns (bool)",
        "event StoragePurchased(address indexed user, address indexed provider, uint256 amount)"
      ];
      
      const storageContract = new ethers.Contract(
        validStorageAddress,
        storageContractABI,
        signer
      );

      // Call purchaseStorage function with proper gas estimation and error handling
      const duration = 30 * 24 * 60 * 60; // 30 seconds threshold
      // Validate provider wallet address with proper checksum
      const validProviderAddress = ethers.getAddress(provider.wallet_address.toLowerCase());
      
      // Get token decimals with proper error handling
      let decimals;
      try {
        decimals = await tokenContract.decimals();
      } catch (error) {
        console.error('Failed to get token decimals:', error);
        decimals = 18; // Default to 18 decimals if call fails
      }

      // Convert amount to token units with proper decimals
      const tokenAmount = ethers.parseUnits(totalCost.toString(), decimals);

      let gasLimit;
      try {
        gasLimit = await storageContract.purchaseStorage.estimateGas(
          validProviderAddress,
          ethers.parseUnits(storageAmount.toString(), 0),
          tokenAmount,
          duration
        );
        // Add 20% buffer to estimated gas
        gasLimit = Math.floor(Number(gasLimit) * 1.2);
      } catch (error) {
        console.error('Gas estimation failed:', error);
        gasLimit = 300000; // Fallback gas limit
      }

      const purchaseTx = await storageContract.purchaseStorage(
        validProviderAddress,
        ethers.parseUnits(storageAmount.toString(), 0),
        tokenAmount,
        duration,
        { gasLimit }
      );

      // Check user's token balance and allowance with proper error handling
      try {
        const balance = await tokenContract.balanceOf(userAddress).catch((error) => {
          console.error('Failed to check token balance:', error);
          if (error.code === 'CALL_EXCEPTION') {
            throw new Error('Failed to check token balance: Contract call failed. Please verify the contract address and try again.');
          } else if (error.code === 'NETWORK_ERROR') {
            throw new Error('Failed to check token balance: Network error. Please check your connection and try again.');
          } else if (error.code === 'TIMEOUT') {
            throw new Error('Failed to check token balance: Request timed out. Please try again.');
          }
          throw new Error('Failed to check token balance: ' + (error.reason || error.message || 'Unknown error'));
        });

        if (balance < tokenAmount) {
          throw new Error(`Insufficient AAI token balance. Required: ${ethers.formatUnits(tokenAmount, decimals)} AAI`);
        }

        // Check existing allowance with proper error handling
        const currentAllowance = await tokenContract.allowance(userAddress, validStorageAddress).catch((error) => {
          console.error('Failed to check token allowance:', error);
          if (error.code === 'CALL_EXCEPTION') {
            throw new Error('Failed to check token allowance: Contract call failed. Please verify the contract address and try again.');
          } else if (error.code === 'NETWORK_ERROR') {
            throw new Error('Failed to check token allowance: Network error. Please check your connection and try again.');
          } else if (error.code === 'TIMEOUT') {
            throw new Error('Failed to check token allowance: Request timed out. Please try again.');
          }
          throw new Error('Failed to check token allowance: ' + (error.reason || error.message || 'Unknown error'));
        });

        if (currentAllowance < tokenAmount) {
          // First approve the storage contract to spend tokens with proper gas estimation
          const approveTx = await tokenContract.approve(
            validStorageAddress,
            tokenAmount,
            { 
              gasLimit: await tokenContract.approve.estimateGas(STORAGE_CONTRACT_ADDRESS, tokenAmount)
                .catch(() => 100000) // Fallback gas limit if estimation fails
            }
          ).catch((error) => {
            console.error('Token approval failed:', error);
            throw new Error('Failed to approve token spending. Please try again.');
          });

          const approveReceipt = await approveTx.wait();
          if (!approveReceipt.status) {
            throw new Error('Token approval transaction failed');
          }
        }

        // Call purchaseStorage function with proper gas estimation
        const duration = 30 * 24 * 60 * 60; // 30 days in seconds
        // Validate provider wallet address with proper checksum
        const validProviderAddress = ethers.getAddress(provider.wallet_address.toLowerCase());
        const purchaseTx = await storageContract.purchaseStorage(
          validProviderAddress,
          ethers.parseUnits(storageAmount.toString(), 0), // Convert to BigInt
          tokenAmount,
          duration,
          { 
            gasLimit: await storageContract.purchaseStorage.estimateGas(
              provider.wallet_address,
              ethers.parseUnits(storageAmount.toString(), 0),
              tokenAmount,
              duration
            ).catch(() => 300000) // Fallback gas limit if estimation fails
          }
        );
        const receipt = await purchaseTx.wait();

        if (!receipt.status) {
          throw new Error('Storage purchase transaction failed');
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30); // Set expiry to 30 days from now

        // Create storage allocation record
        const { error: allocationError } = await supabase
          .from('storage_allocations')
          .insert({
            user_address: userAddress,
            provider_id: provider.id,
            allocated_gb: storageAmount,
            paid_amount: totalCost,
            transaction_hash: purchaseTx.hash,
            expires_at: expiryDate.toISOString()
          });

        if (allocationError) throw allocationError;
      } catch (error: any) {
        console.error('Token contract error:', error);
        throw new Error(
          error.reason || 
          error.data?.message || 
          error.message || 
          'Token contract interaction failed'
        );
      }

      // Update provider's available storage
      const { error: updateError } = await supabase
        .from('storage_providers')
        .update({ 
          available_storage: providerData.available_storage - storageAmount 
        })
        .eq('id', provider.id);

      if (updateError) throw updateError;

      onPurchaseComplete();
    } catch (error: any) {
      console.error('Purchase failed:', error);
      alert(error.message || 'Failed to purchase storage. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Purchase Storage</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Storage Amount (GB)
          </label>
          <input
            type="number"
            min="1"
            max={provider.available_storage}
            value={storageAmount}
            onChange={(e) => setStorageAmount(Math.max(1, parseInt(e.target.value)))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex justify-between text-sm text-gray-600">
          <span>Price per GB:</span>
          <span>{provider.price_per_gb} BNB</span>
        </div>

        <div className="flex justify-between text-sm font-medium">
          <span>Total Cost:</span>
          <span>{(storageAmount * provider.price_per_gb).toFixed(2)} BNB</span>
        </div>

        <button
          onClick={handlePurchase}
          disabled={isLoading || storageAmount < 1}
          className="w-full py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Purchase Storage'}
        </button>
      </div>
    </div>
  );
}