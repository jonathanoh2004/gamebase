'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClientConfig } from '@/lib/env';

let client: SupabaseClient | null = null;

/** The browser's Supabase client: sign-in and the realtime websocket only. */
export function supabaseBrowser(config: ClientConfig): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseKey) throw new Error('Supabase is not configured');
  client ??= createBrowserClient(config.supabaseUrl, config.supabaseKey);
  return client;
}
