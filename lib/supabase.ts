import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { DEV_MODE } from './dev-mode';
import { createChunkedSecureStorage } from './secure-chunk-storage';

let storage: any = undefined;

if (Platform.OS !== 'web') {
  const SecureStore = require('expo-secure-store');
  // Chunked, not a plain passthrough. SecureStore fails above ~2 KB on
  // Android and a Supabase session blob routinely exceeds it — silently, so
  // the app looks signed in until the next cold start. See the file header.
  // Legacy un-chunked values are still readable, so this ships without
  // logging anyone out.
  storage = createChunkedSecureStorage(SecureStore);
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: DEV_MODE ? undefined : storage,
    autoRefreshToken: !DEV_MODE,
    persistSession: !DEV_MODE,
    detectSessionInUrl: false,
  },
});
