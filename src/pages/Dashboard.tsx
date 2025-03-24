import React, { useEffect, useState } from 'react';
import { HardDrive, Upload, Download, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ethers } from 'ethers';

function StatCard({ icon: Icon, label, value, subValue }: any) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-purple-50 rounded-lg">
          <Icon className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {subValue && (
            <p className="text-sm text-gray-500">{subValue}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [storageStats, setStorageStats] = useState({
    totalStorage: 0,
    usedStorage: 0,
    totalFiles: 0,
    downloadedThisMonth: 0,
    remainingDays: 0
  });
  const [providers, setProviders] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [userAddress, setUserAddress] = useState('');

  useEffect(() => {
    // Get user's wallet address
    const getUserAddress = async () => {
      try {
        const ethProvider = new ethers.BrowserProvider((window as any).ethereum);
        const signer = await ethProvider.getSigner();
        const address = await signer.getAddress();
        setUserAddress(address);
      } catch (error) {
        console.error('Error getting wallet address:', error);
      }
    };
    getUserAddress();
  }, []);

  useEffect(() => {
    if (!userAddress) return;

    // Set up real-time subscription for storage allocations
    const allocationsSubscription = supabase
      .channel('storage_allocations_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'storage_allocations', filter: `user_address=eq.${userAddress}` },
        () => fetchDashboardData()
      )
      .subscribe();

    // Initial data fetch
    fetchDashboardData();

    return () => {
      allocationsSubscription.unsubscribe();
    };
  }, [userAddress]);

  async function fetchDashboardData() {
    if (!userAddress) return;

    try {
      // Fetch storage allocations
      const { data: allocations } = await supabase
        .from('storage_allocations')
        .select('allocated_gb, expires_at, provider_id')
        .eq('user_address', userAddress);

      // Fetch stored files
      const { data: files } = await supabase
        .from('stored_files')
        .select('*')
        .eq('user_address', userAddress)
        .order('created_at', { ascending: false });

      // Calculate storage stats
      const totalStorage = allocations?.reduce((sum, alloc) => sum + Number(alloc.allocated_gb), 0) || 0;
      const usedStorage = files?.reduce((sum, file) => sum + Number(file.file_size), 0) / (1024 * 1024 * 1024) || 0;
      const nearestExpiry = allocations?.reduce((nearest, alloc) => 
        !nearest || new Date(alloc.expires_at) < new Date(nearest) ? alloc.expires_at : nearest
      , null);

      setStorageStats({
        totalStorage,
        usedStorage,
        totalFiles: files?.length || 0,
        downloadedThisMonth: 0,
        remainingDays: nearestExpiry ? Math.ceil((new Date(nearestExpiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0
      });

      // Fetch and set recent activity
      setRecentActivity(
        (files?.slice(0, 3) || []) as Array<{
          id: string;
          file_name: string;
          file_size: number;
          created_at: string;
        }>
      );

      // Fetch provider details
      if (allocations?.length) {
        const providerIds = [...new Set(allocations.map(a => a.provider_id))];
        const { data: providerData } = await supabase
          .from('storage_providers')
          .select('*')
          .in('id', providerIds);


        // Type the provider data properly to fix the setState type error
        interface Provider {
          id: string;
          name: string;
          available_storage: number;
          price_per_gb: number;
          is_active: boolean;
          updated_at: string;
        }
        
        setProviders(providerData ? providerData as Provider[] : []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={HardDrive}
          label="Total Storage"
          value={`${storageStats.totalStorage} GB`}
          subValue={`Used: ${storageStats.usedStorage.toFixed(2)} GB`}
        />
        <StatCard
          icon={Upload}
          label="Uploaded"
          value={storageStats.totalFiles}
          subValue="Total files"
        />
        <StatCard
          icon={Download}
          label="Downloaded"
          value={`${storageStats.downloadedThisMonth.toFixed(2)} GB`}
          subValue="This month"
        />
        <StatCard
          icon={Clock}
          label="Storage Time"
          value={`${storageStats.remainingDays} days`}
          subValue="Remaining"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Upload className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">File uploaded</p>
                  <p className="text-xs text-gray-500">{activity.file_name} • {(activity.file_size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <span className="ml-auto text-xs text-gray-500">
                  {new Date(activity.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Storage Providers */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Storage Providers</h3>
          <div className="space-y-4">
            {providers.map((provider) => (
              <div key={provider.id} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <HardDrive className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                  <p className="text-xs text-gray-500">{provider.available_storage} GB available • {provider.price_per_gb} AAI/GB</p>
                </div>
                <span
                  className={`ml-auto text-xs font-medium ${provider.is_active && provider.available_storage > 0 && new Date(provider.updated_at).getTime() > Date.now() - 30 * 1000 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {provider.is_active && provider.available_storage > 0 && new Date(provider.updated_at).getTime() > Date.now() - 30 * 1000 ? 'Online' : 'Offline'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;