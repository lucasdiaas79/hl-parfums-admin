import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hqszfftdntquueizyats.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_eRi1QPhe1uu70iRQdzlrkg_6-b_5Zyl';
export const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || 'https://hl-parfums.vercel.app';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'hl-admin-auth' },
});

// O acesso é pelo número; no Supabase ele vira um e-mail interno.
export const LOGIN_DOMAIN = 'hlparfums.app';
export function numberToEmail(n: string) {
  const digits = n.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return `${digits}@${LOGIN_DOMAIN}`;
}
export function emailToNumber(e?: string | null) {
  return (e || '').split('@')[0];
}
