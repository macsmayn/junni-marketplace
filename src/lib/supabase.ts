import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cnuankrdyxfaczsfmimm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mjsQt-QC5F9kYKufdQfF2w_cSKRetkT';

// ── ID-token track (used by Supabase client for DB / RLS queries) ─────────────
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

// ── Access-token track (used by edge functions via X-Auth0-Token) ─────────────
// Auth0's /userinfo endpoint requires an access token, not an ID token.
// getAccessTokenSilently() returns the correct token when an audience is set
// in Auth0Provider (confirmed: audience "https://junni-market-2.manus.space").
let accessTokenProvider: (() => Promise<string | null>) | null = null;

export function setAccessTokenProvider(fn: () => Promise<string | null>) {
  accessTokenProvider = fn;
}

async function resolveAccessToken(): Promise<string> {
  if (accessTokenProvider) {
    try {
      return (await accessTokenProvider()) ?? '';
    } catch {
      return '';
    }
  }
  return '';
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { accessToken: resolveToken }
)

// Edge functions: anon key stays in Authorization (for Supabase's verify_jwt
// gate); the Auth0 access token goes in X-Auth0-Token so the function can
// verify caller identity via Auth0's /userinfo endpoint.
export async function invokeFunction(
  name: string,
  body: unknown
): Promise<{ data: unknown; error: Error | null }> {
  const accessToken = await resolveAccessToken();
  return supabase.functions.invoke(name, {
    body,
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'X-Auth0-Token': accessToken,
    },
  });
}

// Like invokeFunction but returns the raw HTTP status so callers can
// distinguish 402 / 403 / 409-seat_limit / 409-duplicate etc.
export async function invokeFunctionWithDetails(
  name: string,
  body: unknown
): Promise<{ data: any; httpStatus: number }> {
  const accessToken = await resolveAccessToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'X-Auth0-Token': accessToken,
    },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try { data = await res.json(); } catch {}
  return { data, httpStatus: res.status };
}
