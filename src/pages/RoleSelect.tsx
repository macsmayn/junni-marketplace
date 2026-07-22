import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase, setSupabaseAuthToken } from '../lib/supabase';

export default function RoleSelect() {
  const [, setLocation] = useLocation();
  const { isLoading, user, getIdTokenClaims } = useAuth0();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [readError, setReadError] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user?.email) {
      setCheckingAdmin(false);
      return;
    }
    (async () => {
      // Set token before read to avoid the race with App.tsx's async getIdTokenClaims
      const claims = await getIdTokenClaims();
      setSupabaseAuthToken(claims?.__raw ?? null);

      const { data: existingUser, error } = await supabase
        .from('users')
        .select('role')
        .eq('auth0_id', user.sub)
        .maybeSingle();

      if (error) {
        console.error('[RoleSelect] users read failed:', error);
        setReadError(true);
        setCheckingAdmin(false);
        return;
      }

      if (existingUser) {
        if (existingUser.role === 'admin')    { setLocation('/admin'); return; }
        if (existingUser.role === 'lender')   { setLocation('/lender-dashboard'); return; }
        if (existingUser.role === 'borrower') { setLocation('/borrower-dashboard'); return; }
        // Unknown role but row exists — do not re-insert, default to lender dashboard
        setLocation('/lender-dashboard');
        return;
      }

      // No row found — genuine new user; DB default sets role='lender'
      await supabase.from('users').upsert({
        auth0_id: user.sub,
        email: user.email,
        full_name: user.name,
      }, { onConflict: 'auth0_id' });
      setLocation('/lender-dashboard');
    })();
  }, [isLoading, user?.email]);

  if (isLoading || checkingAdmin) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        Loading...
      </div>
    );
  }

  if (readError) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "Inter, sans-serif", color: "#DC2626", fontSize: 14 }}>
        Unable to load your account. Please refresh the page or contact support.
      </div>
    );
  }

  return null;
}
