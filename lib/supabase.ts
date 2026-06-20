import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function getOptimizedPhotoUrl(url: string, width = 600): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('width', String(width));
    parsed.searchParams.set('quality', '80');
    return parsed.toString();
  } catch {
    return url;
  }
}