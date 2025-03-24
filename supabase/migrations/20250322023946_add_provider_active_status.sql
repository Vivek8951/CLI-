-- Add active status field to storage_providers table
ALTER TABLE storage_providers
ADD COLUMN is_active boolean NOT NULL DEFAULT false;

-- Update existing providers to be active
UPDATE storage_providers
SET is_active = true;

-- Add index for faster status lookups
CREATE INDEX idx_storage_providers_active_status ON storage_providers(is_active);