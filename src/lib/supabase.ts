import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sypqecydiqdpruarkrvy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DB4ZyrLd-8wYkE0HgBokLg_GN6cU_NB';

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
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { accessToken: resolveToken }
)

// Edge functions verify JWTs against Supabase's own JWT secret. Auth0 tokens
// are signed with Auth0's key, which Supabase doesn't know, so they always
// fail verify_jwt. The anon key is a valid Supabase-signed JWT and passes.
// Per-user identity is not currently available inside edge functions; they use
// the service role key internally for all DB access.
export async function invokeFunction(
  name: string,
  body: unknown
): Promise<{ data: unknown; error: Error | null }> {
  return supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
}
