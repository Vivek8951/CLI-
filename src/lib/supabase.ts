import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client - Replace with actual values from environment variables
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);