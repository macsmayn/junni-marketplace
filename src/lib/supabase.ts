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

// Edge functions verify_jwt checks against Supabase's own JWT secret, so the
// anon key stays in Authorization to pass that gate. The caller's Auth0 ID
// token travels separately in X-Auth0-Token, where the function verifies it
// against Auth0's /userinfo endpoint to establish caller identity.
export async function invokeFunction(
  name: string,
  body: unknown
): Promise<{ data: unknown; error: Error | null }> {
  const idToken = await resolveToken();
  return supabase.functions.invoke(name, {
    body,
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'X-Auth0-Token': idToken,
    },
  });
}
