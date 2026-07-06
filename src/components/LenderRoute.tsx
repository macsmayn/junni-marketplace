import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../lib/supabase';

interface LenderRouteProps {
  children: React.ReactNode;
}

export default function LenderRoute({ children }: LenderRouteProps) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth0();
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user?.sub) {
      setRoleLoading(false);
      return;
    }
    supabase
      .from("users")
      .select("role")
      .eq("auth0_id", user.sub)
      .maybeSingle()
      .then(({ data, error }) => {
        setRole(error || !data ? null : data.role);
        setRoleLoading(false);
      });
  }, [authLoading, isAuthenticated, user?.sub]);

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!isAuthenticated || (role !== "lender" && role !== "admin")) {
      setLocation("/");
    }
  }, [authLoading, roleLoading, isAuthenticated, role]);

  if (authLoading || roleLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated || (role !== "lender" && role !== "admin")) {
    return null;
  }

  return <>{children}</>;
}
