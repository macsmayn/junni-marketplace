import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../lib/supabase';

const LOGO_BEIGE = "/junni-logo-beige.png";

export default function RoleSelect() {
  const [, setLocation] = useLocation();
  const { logout, isLoading, user } = useAuth0();
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!user?.email) {
      setCheckingAdmin(false);
      return;
    }
    (async () => {
      const { data: existingUser } = await supabase
        .from('users')
        .select('role')
        .eq('auth0_id', user.sub)
        .maybeSingle();
      if (existingUser?.role === 'borrower') { setLocation('/borrower-dashboard'); return; }
      if (existingUser?.role === 'lender')   { setLocation('/lender-dashboard'); return; }
      if (existingUser?.role === 'admin')    { setLocation('/admin'); return; }
      await supabase.from('users').upsert({
        auth0_id: user.sub,
        email: user.email,
        full_name: user.name,
      }, { onConflict: 'auth0_id' });
      setLocation('/lender-dashboard');
    })();
  }, [isLoading, user?.email]);

  const upsertUser = async (role: 'borrower' | 'lender') => {
    if (!user) {
      console.error('No Auth0 user found');
      return;
    }
    console.log('Attempting upsert for:', user.sub, user.email, user.name, role);
    const { data, error } = await supabase.from('users').upsert({
      auth0_id: user.sub,
      email: user.email,
      full_name: user.name,
      role,
    }, { onConflict: 'auth0_id' });
    console.log('Upsert result:', data, error);
    if (error) console.error('Supabase upsert error:', error);
  };

  const handleBorrowerClick = async () => {
    setActiveRole("borrower");
    await upsertUser("borrower");
    setLocation("/onboarding");
  };

  const handleLenderClick = async () => {
    setActiveRole("lender");
    await upsertUser("lender");
    setLocation("/lender-onboarding");
  };

  if (isLoading || checkingAdmin) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        Loading...
      </div>
    );
  }

  return null;
}
