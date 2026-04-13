import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { DEV_MODE } from './dev-mode';

let storage: any = undefined;

if (Platform.OS !== 'web') {
  const SecureStore = require('expo-secure-store');
  storage = {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  };
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
