/*
  # Initial Schema Setup for Alpha AI Storage

  1. New Tables
    - `storage_providers`
      - `id` (uuid, primary key)
      - `name` (text)
      - `wallet_address` (text)
      - `available_storage` (bigint)
      - `price_per_gb` (numeric)
      - `ipfs_node_id` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `storage_allocations`
      - `id` (uuid, primary key)
      - `user_address` (text)
      - `provider_id` (uuid, references storage_providers)
      - `allocated_gb` (numeric)
      - `paid_amount` (numeric)
      - `transaction_hash` (text)
      - `expires_at` (timestamp)
      - `created_at` (timestamp)

    - `stored_files`
      - `id` (uuid, primary key)
      - `user_address` (text)
      - `provider_id` (uuid, references storage_providers)
      - `file_name` (text)
      - `file_size` (bigint)
      - `ipfs_cid` (text)
      - `mime_type` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create storage_providers table
CREATE TABLE storage_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    wallet_address text NOT NULL UNIQUE,
    available_storage bigint NOT NULL DEFAULT 0,
    price_per_gb numeric NOT NULL DEFAULT 0,
    ipfs_node_id text NOT NULL,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create storage_allocations table
CREATE TABLE storage_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address text NOT NULL,
    provider_id uuid REFERENCES storage_providers(id) ON DELETE CASCADE,
    allocated_gb numeric NOT NULL,
    paid_amount numeric NOT NULL,
    transaction_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Create stored_files table
CREATE TABLE stored_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_address text NOT NULL,
    provider_id uuid REFERENCES storage_providers(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_size bigint NOT NULL,
    ipfs_cid text NOT NULL,
    mime_type text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE storage_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stored_files ENABLE ROW LEVEL SECURITY;

-- Create policies for storage_providers
CREATE POLICY "Anyone can view storage providers"
    ON storage_providers
    FOR SELECT
    TO public
    USING (true);

-- Create policies for storage_allocations
CREATE POLICY "Users can view their own storage allocations"
    ON storage_allocations
    FOR SELECT
    TO public
    USING (user_address = current_user);

CREATE POLICY "Users can create their own storage allocations"
    ON storage_allocations
    FOR INSERT
    TO public
    WITH CHECK (user_address = current_user);

-- Create policies for stored_files
CREATE POLICY "Users can view their own files"
    ON stored_files
    FOR SELECT
    TO public
    USING (user_address = current_user);

CREATE POLICY "Users can upload their own files"
    ON stored_files
    FOR INSERT
    TO public
    WITH CHECK (user_address = current_user);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for storage_providers
CREATE TRIGGER update_storage_providers_updated_at
    BEFORE UPDATE ON storage_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();