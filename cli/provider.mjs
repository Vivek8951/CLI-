import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, access } from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Initialize Supabase client
let supabase;
try {
  supabase = createClient(
    'https://bcrzplbyvjynicxptuix.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjcnpwbGJ5dmp5bmljeHB0dWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0NzA1OTIsImV4cCI6MjA1ODA0NjU5Mn0.Z-RtPx9DzUnZdagxU4FHZBLy6SwZLpeAuxlVxonTbjM'
  );
} catch (error) {
  console.error(chalk.red('Failed to initialize Supabase client:', error.message));
  process.exit(1);
}

// Define tables and operations
const TABLES = {
  PROVIDERS: 'storage_providers',
  STORED_FILES: 'stored_files',
  STORAGE_ALLOCATIONS: 'storage_allocations'
};

const providerOperations = {
  async getProviderByAddress(address) {
    const { data, error } = await supabase
      .from(TABLES.PROVIDERS)
      .select('*')
      .eq('wallet_address', address)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async updateProviderStatus(address, isOnline) {
    const { error } = await supabase
      .from(TABLES.PROVIDERS)
      .update({ 
        updated_at: new Date().toISOString(),
        is_active: isOnline
      })
      .eq('wallet_address', address);
    if (error) throw error;
  }
};

// Dynamic imports for ESM modules
const loadDependencies = async () => {
  const inquirer = await import('inquirer');
  return { inquirer: inquirer.default, TABLES, providerOperations };
};

// Initialize dependencies and start the CLI
const program = new Command();

program
  .name('alpha-ai-provider')
  .description('Alpha AI DePIN Storage Provider CLI')
  .version('1.0.0');

program.command('start')
  .description('Start providing storage')
  .action(async () => {
    try {
      const { inquirer } = await loadDependencies();
      console.log(chalk.blue('🚀 Starting Alpha AI Storage Provider...'));

      // Initialize IPFS first
      try {
        // Check if IPFS daemon is already running
        try {
          await execAsync('ipfs swarm peers');
          console.log(chalk.green('✓ IPFS daemon is already running'));
        } catch {
          console.log(chalk.red('Error: IPFS daemon is not running. Please start it using "ipfs daemon" command first.'));
          process.exit(1);
        }

        // Get provider information
        const answers = await inquirer.prompt([
          {
            type: 'password',
            name: 'privateKey',
            message: 'Enter your private key (will be securely stored):',
            validate: (input) => {
              try {
                const formattedKey = input.startsWith('0x') ? input : `0x${input}`;
                const wallet = new ethers.Wallet(formattedKey);
                return true;
              } catch {
                return 'Invalid private key';
              }
            }
          },
          {
            type: 'list',
            name: 'storageDir',
            message: 'Select storage directory:',
            choices: async () => {
              try {
                let drives = [];
                if (os.platform() === 'win32') {
                  const { stdout } = await execAsync('wmic logicaldisk get name');
                  drives = stdout.split('\r\r\n')
                    .filter(d => d.trim() && d !== 'Name')
                    .map(d => d.trim());
                } else {
                  // For Linux/Unix systems, check common mount points
                  const { stdout } = await execAsync('df -h --output=target');
                  drives = stdout.split('\n')
                    .slice(1) // Skip header
                    .filter(d => d.trim())
                    .map(d => d.trim())
                    .filter(d => ["/", "/home", "/mnt", "/media"].some(prefix => d.startsWith(prefix)));
                }

                if (drives.length === 0) {
                  drives = [os.homedir()]; // Fallback to user's home directory
                }

                return [
                  ...drives.map(drive => ({
                    name: `${drive} (${os.platform() === 'win32' ? 'Drive' : 'Mount Point'})`,
                    value: drive
                  })),
                  {
                    name: 'Custom Path',
                    value: 'custom'
                  }
                ];
              } catch (error) {
                console.error(chalk.red('Error getting storage locations:', error.message));
                return [{
                  name: os.homedir(),
                  value: os.homedir()
                }];
              }
            }
          },
          {
            type: 'input',
            name: 'customStorageDir',
            message: 'Enter custom storage path:',
            when: (answers) => answers.storageDir === 'custom',
            validate: async (input) => {
              try {
                await access(input);
                return true;
              } catch {
                return 'Invalid directory path. Please enter a valid path.';
              }
            }
          },
          {
            type: 'number',
            name: 'storageSize',
            message: 'Enter storage size to allocate (in GB):',
            validate: (input) => {
              if (isNaN(input) || input <= 0) {
                return 'Please enter a valid storage size greater than 0';
              }
              return true;
            }
          }
        ]);

        // Process answers and start provider
        const privateKey = answers.privateKey;
        const storageDir = answers.storageDir === 'custom' ? answers.customStorageDir : answers.storageDir;
        const storageSize = answers.storageSize;

        // Initialize provider
        const wallet = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
        const address = wallet.address;

        let providerData = await providerOperations.getProviderByAddress(address);

        // Configure storage directory with platform-specific handling
        let providerStorageDir;
        try {
          if (os.platform() === 'win32') {
            providerStorageDir = path.join(storageDir, 'alpha-ai-storage');
          } else {
            // For Linux/Unix, ensure we have proper permissions
            const baseDir = storageDir === 'custom' ? storageDir : path.join(os.homedir(), '.alpha-ai-storage');
            providerStorageDir = path.join(baseDir, 'storage');
          }
          
          await mkdir(providerStorageDir, { recursive: true, mode: 0o755 });
          console.log(chalk.green(`✓ Storage directory created at: ${providerStorageDir}`));
          
          // Verify write permissions
          const testFile = path.join(providerStorageDir, '.write-test');
          await mkdir(testFile, { recursive: true });
          await execAsync(`rm ${os.platform() === 'win32' ? '-r' : '-rf'} "${testFile}"`);
        } catch (error) {
          console.error(chalk.red(`Failed to create or access storage directory: ${error.message}`));
          console.log(chalk.yellow('Please ensure you have proper permissions to create and write to the selected directory.'));
          process.exit(1);
        }

        // Store provider data if new
        if (!providerData) {
          const { data: newProvider, error } = await supabase
            .from(TABLES.PROVIDERS)
            .insert([{
              name: `Provider ${address.slice(0, 6)}`,
              wallet_address: address,
              available_storage: storageSize,
              price_per_gb: 1.00,
              ipfs_node_id: 'QmNodeId', // This should be fetched from IPFS
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_active: true
            }])
            .select()
            .single();

          if (error) throw error;
          providerData = newProvider;
        }

        // Update provider status
        await providerOperations.updateProviderStatus(address, true);

        console.log(chalk.green(`Provider address: ${address}`));
        console.log(chalk.green('Storage provider is now online and ready to accept files!'));

        let lastStatusLogTime = Date.now();
        const STATUS_LOG_INTERVAL = 3600000; // 1 hour in milliseconds

        // Keep the process running and update status periodically
        const updateStatusInterval = setInterval(async () => {
          try {
            // Check IPFS daemon status and system health
            const { stdout } = await execAsync('ipfs swarm peers');
            const isIpfsOnline = stdout.length > 0;
            
            // Get current provider status
            const currentProvider = await providerOperations.getProviderByAddress(address);
            const lastUpdateTime = new Date(currentProvider?.updated_at || 0);
            const timeSinceLastUpdate = Date.now() - lastUpdateTime.getTime();
            
            // Check if provider is truly active
            const isProviderActive = isIpfsOnline && timeSinceLastUpdate < 30000; // 30 seconds threshold

            if (!isIpfsOnline) {
              console.log(chalk.yellow('Warning: IPFS daemon is not connected to peers'));
              await providerOperations.updateProviderStatus(address, false);
              return;
            }

            // Update provider status in database with timestamp verification
            await providerOperations.updateProviderStatus(address, isProviderActive);
            
            // Only log status updates once per hour
            const now = Date.now();
            if (now - lastStatusLogTime >= STATUS_LOG_INTERVAL) {
              console.log(chalk.green(`Provider status updated successfully (Active: ${isProviderActive})`));
              lastStatusLogTime = now;
            }

            // Get IPFS repo stats
            let usedStorage = 0;
            try {
              const { stdout: repoStats } = await execAsync('ipfs repo stat -s');
              usedStorage = parseFloat(repoStats) / (1024 * 1024 * 1024); // Convert to GB
            } catch {}

            // Get total allocated storage for this provider
            const { data: allocations, error: allocError } = await supabase
              .from(TABLES.STORAGE_ALLOCATIONS)
              .select('allocated_gb')
              .eq('provider_id', providerData.id)
              .gte('expires_at', new Date().toISOString());

            if (allocError) throw allocError;

            const totalAllocated = allocations?.reduce((sum, alloc) => sum + Number(alloc.allocated_gb), 0) || 0;

            // Update provider status with correct available storage
            const { error: updateError } = await supabase
              .from(TABLES.PROVIDERS)
              .update({
                available_storage: storageSize,
                updated_at: new Date().toISOString()
              })
              .eq('wallet_address', address);

            if (updateError) {
              console.error(chalk.yellow('Failed to update storage:', updateError.message));
            }
          } catch (error) {
            console.error(chalk.red('Failed to update provider status:', error.message));
            await providerOperations.updateProviderStatus(address, false);
          }
        }, 15000); // Update every 15 seconds

        // Handle graceful shutdown
        const cleanup = async () => {
          clearInterval(updateStatusInterval);
          await providerOperations.updateProviderStatus(address, false);
          console.log(chalk.yellow('\nProvider is shutting down...'));
          process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
      } catch (error) {
        console.error(chalk.red('Failed to initialize dependencies:', error.message));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error:', error.message));
      process.exit(1);
    }
  });

program.parse(process.argv);