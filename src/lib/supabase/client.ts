import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cxbevwccenradkjxoooh.supabase.co';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4YmV2d2NjZW5yYWRranhvb29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2ODMxNjgsImV4cCI6MjA4MTI1OTE2OH0.DJSH0CpPAPciTPD4EsHsioLUOobkikiqVEW8wS02Itw';

  return createBrowserClient(url, anonKey);
}
