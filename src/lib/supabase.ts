import { createClient } from '@supabase/supabase-js'

let currentToken: string | null = null;
let tokenProvider: (() => Promise<string | null>) | null = null;

export function setSupabaseAuthToken(token: string | null) {
  currentToken = token;
}

export function setTokenProvider(fn: () => Promise<string | null>) {
  tokenProvider = fn;
}

async function resolveToken(): Promise<string> {
  if (currentToken !== null) return currentToken;
  if (tokenProvider) {
    const t = await tokenProvider();
    if (t) currentToken = t;
    return t ?? '';
  }
  return '';
}

export const supabase = createClient(
  'https://sypqecydiqdpruarkrvy.supabase.co',
  'sb_publishable_DB4ZyrLd-8wYkE0HgBokLg_GN6cU_NB',
  { accessToken: resolveToken }
)
