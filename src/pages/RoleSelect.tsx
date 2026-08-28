import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase, setSupabaseAuthToken, invokeFunction } from '../lib/supabase';

export default function RoleSelect() {
  const [, setLocation] = useLocation();
  const { isLoading, user, getIdTokenClaims } = useAuth0();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [readError, setReadError] = useState(false);
  const [provisionError, setProvisionError] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user?.email) {
      setCheckingAdmin(false);
      return;
    }
    (async () => {
      // Set token before any network call to avoid the race with App.tsx's async getIdTokenClaims
      const claims = await getIdTokenClaims();
      setSupabaseAuthToken(claims?.__raw ?? null);

      // Provision the user atomically via edge function on every login.
      // Idempotent: returns already_provisioned:true immediately if org_id is already set.
      const { data: provisionData, error: provisionErr } = await invokeFunction("provision-user", {});
      if (provisionErr) {
        console.error('[RoleSelect] provision-user failed:', provisionErr, 'data:', provisionData);
        setProvisionError(true);
        setCheckingAdmin(false);
        return;
      }
      const pd = provisionData as any;
      if (!pd?.org_id) {
        console.error('[RoleSelect] provision-user returned no org_id — full response:', provisionData);
        setProvisionError(true);
        setCheckingAdmin(false);
        return;
      }

      const { data: existingUser, error } = await supabase
        .from('users')
        .select('role, first_name')
        .eq('auth0_id', user.sub)
        .maybeSingle();

      if (error) {
        console.error('[RoleSelect] users read failed:', error);
        setReadError(true);
        setCheckingAdmin(false);
        return;
      }

      if (existingUser) {
        // Profile incomplete → collect name before routing anywhere
        if (!existingUser.first_name?.trim()) {
          setLocation('/complete-profile');
          return;
        }
        if (existingUser.role === 'admin')    { setLocation('/admin'); return; }
        if (existingUser.role === 'lender')   { setLocation('/lender-dashboard'); return; }
        if (existingUser.role === 'borrower') { setLocation('/borrower-dashboard'); return; }
        // Unknown role but row exists — default to lender dashboard
        setLocation('/lender-dashboard');
        return;
      }

      // Provision succeeded but no users row is readable — should not occur
      console.error('[RoleSelect] provision-user succeeded but users row not readable — provisionData:', provisionData);
      setProvisionError(true);
      setCheckingAdmin(false);
    })();
  }, [isLoading, user?.email]);

  if (isLoading || checkingAdmin) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        Loading...
      </div>
    );
  }

  if (provisionError) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "Inter, sans-serif", color: "#DC2626", fontSize: 14 }}>
        We could not set up your account. Please try again or contact support.
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
