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

  const handlePurchase = async () => {
    try {
      setIsLoading(true);

      // Check if wallet is connected and get provider
      if (!(window as any).ethereum) {
        throw new Error('Please install MetaMask or another Web3 wallet');
      }

      // Ensure correct network
      const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0x61') { // BSC Testnet chainId
        throw new Error('Please switch to BSC Testnet to continue');
      }

      const bscProvider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await bscProvider.getSigner();
      const userAddress = await signer.getAddress();

      // Initialize token contract with proper error handling
      let tokenContract;
      try {
        tokenContract = new ethers.Contract(
          AAI_TOKEN_ADDRESS,
          [
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function approve(address spender, uint256 value) returns (bool)",
            "function allowance(address owner, address spender) view returns (uint256)"
          ],
          signer
        );

        // Verify contract existence
        const code = await bscProvider.getCode(AAI_TOKEN_ADDRESS);
        if (!code || code === '0x' || code === '0x0') {
          throw new Error('Token contract not found. Please verify the contract address.');
        }
      } catch (error) {
        console.error('Token contract initialization error:', error);
        throw new Error('Failed to initialize token contract. Please verify the contract address and network connection.');
      }

      // Calculate total cost in AAI tokens
      let decimals;
      try {
        decimals = await tokenContract.decimals();
      } catch (error) {
        console.error('Failed to get token decimals:', error);
        throw new Error('Failed to get token information. Please verify the contract address.');
      }

      const totalCost = storageAmount * provider.price_per_gb;
      const tokenAmount = ethers.parseUnits(totalCost.toString(), decimals);

      // Check user's token balance with improved error handling
      let balance;
      try {
        balance = await tokenContract.balanceOf(userAddress);
        
        if (balance === undefined || balance === null || balance === '0x') {
          throw new Error('Invalid balance response from contract');
        }

        const formattedBalance = ethers.formatUnits(balance, decimals);
        console.log('Current balance:', formattedBalance, 'AAI');

        if (balance === 0n) {
          throw new Error(`No AAI tokens found in your wallet. Current balance: ${formattedBalance} AAI`);
        }

        if (balance < tokenAmount) {
          const formattedRequired = ethers.formatUnits(tokenAmount, decimals);
          throw new Error(`Insufficient AAI tokens. You have ${formattedBalance} AAI but need ${formattedRequired} AAI`);
        }
      } catch (error: any) {
        console.error('Balance check error:', error);
        
        if (error.code === 'BAD_DATA' || error.message?.includes('BAD_DATA')) {
          throw new Error('Unable to verify token balance. Please ensure you have AAI tokens and are connected to BSC Testnet.');
        }
        
        if (error.message?.includes('Invalid balance response')) {
          throw new Error('Failed to read token balance. Please try again or contact support.');
        }
        
        if (error.message?.includes('0x')) {
          throw new Error('Invalid token balance format. Please ensure you are connected to BSC Testnet.');
        }
        
        throw error;
      }

      // Request token approval from user
      const initialAllowance = await tokenContract.allowance(userAddress, STORAGE_CONTRACT_ADDRESS);
      
      if (initialAllowance < tokenAmount) {
        try {
          const approveTx = await tokenContract.approve(STORAGE_CONTRACT_ADDRESS, tokenAmount);
          await approveTx.wait();
        } catch (error: unknown) {
          if (error instanceof Error && 'code' in error && error.code === 'ACTION_REJECTED') {
            throw new Error('You rejected the token approval. Please approve to continue.');
          }
          throw new Error('Failed to approve token spending. Please try again.');
        }
      }

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

      // Check current provider storage before updating
      const { data: currentProviderData, error: currentProviderError } = await supabase
        .from('storage_providers')
        .select('available_storage')
        .eq('id', provider.id)
        .single();

      if (currentProviderError) {
        throw new Error('Failed to get current provider storage: ' + currentProviderError.message);
      }

      if (!currentProviderData || currentProviderData.available_storage < storageAmount) {
        throw new Error('Storage amount no longer available. Please try again with a smaller amount.');
      }

      // Update provider's available storage with current value
      const { error: updateError } = await supabase
        .from('storage_providers')
        .update({ 
          available_storage: currentProviderData.available_storage - storageAmount 
        })
        .eq('id', provider.id);

      if (updateError) {
        throw new Error('Failed to update provider storage: ' + updateError.message);
      }

      // Initialize storage contract with proper error handling and complete ABI
      if (!STORAGE_CONTRACT_ADDRESS || typeof STORAGE_CONTRACT_ADDRESS !== 'string') {
        throw new Error('Storage contract address is not configured or invalid.');
      }

      // Validate and format the contract address
      let validStorageAddress;
      try {
        const cleanAddress = STORAGE_CONTRACT_ADDRESS.trim().toLowerCase();
        if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
          throw new Error('Invalid address format');
        }
        validStorageAddress = ethers.getAddress(cleanAddress);
      } catch (error) {
        throw new Error('Invalid storage contract address format.');
      }

      // Verify contract existence and bytecode
      const code = await bscProvider.getCode(validStorageAddress);
      if (!code || code === '0x' || code === '0x0') {
        throw new Error(`No contract found at address ${validStorageAddress}`);
      }

      const storageContractABI = [
        "function purchaseStorage(address provider, uint256 storageAmount, uint256 tokenAmount, uint256 duration) external returns (bool)",
        "event StoragePurchased(address indexed user, address indexed provider, uint256 amount)"
      ];
      
      const storageContract = new ethers.Contract(
        validStorageAddress,
        storageContractABI,
        signer
      );

      // Check and set token allowance if needed
      const currentAllowance = await tokenContract.allowance(userAddress, validStorageAddress);
      if (currentAllowance < tokenAmount) {
        const approveTx = await tokenContract.approve(validStorageAddress, tokenAmount);
        await approveTx.wait();
      }

      // Call purchaseStorage function with proper gas estimation
      const duration = 30 * 24 * 60 * 60; // 30 days in seconds
      const validProviderAddress = ethers.getAddress(provider.wallet_address);

      let gasLimit;
      try {
        gasLimit = await storageContract.purchaseStorage.estimateGas(
          validProviderAddress,
          ethers.parseUnits(storageAmount.toString(), 0),
          tokenAmount,
          duration
        );
        gasLimit = Math.floor(Number(gasLimit) * 1.2); // Add 20% buffer
      } catch (error) {
        gasLimit = 300000; // Fallback gas limit
      }

      const purchaseTx = await storageContract.purchaseStorage(
        validProviderAddress,
        ethers.parseUnits(storageAmount.toString(), 0),
        tokenAmount,
        duration,
        { gasLimit }
      );

      const receipt = await purchaseTx.wait();
      if (!receipt.status) {
        throw new Error('Storage purchase transaction failed');
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

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

      if (allocationError) {
        throw new Error('Failed to create allocation record: ' + allocationError.message);
      }

      onPurchaseComplete();
    } catch (error) {
      console.error('Purchase failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to purchase storage. Please try again.');
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
          <span>{provider.price_per_gb} AAI</span>
        </div>

        <div className="flex justify-between text-sm font-medium">
          <span>Total Cost:</span>
          <span>{(storageAmount * provider.price_per_gb).toFixed(2)} AAI</span>
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