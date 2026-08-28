import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../lib/supabase';

interface LenderRouteProps {
  children: React.ReactNode;
}

const SKIP_RETURN_PATHS = new Set([
  "/", "/login", "/role-select",
  "/lender-dashboard", "/admin", "/borrower-dashboard", "/complete-profile",
]);

export default function LenderRoute({ children }: LenderRouteProps) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth0();
  const [, setLocation] = useLocation();
  const [role, setRole]             = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [queryFailed, setQueryFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user?.sub) {
      setRoleLoading(false);
      return;
    }
    setQueryFailed(false);
    setRoleLoading(true);
    supabase
      .from("users")
      .select("role")
      .eq("auth0_id", user.sub)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          // Query failed — do not redirect; let the user retry
          setQueryFailed(true);
          setRoleLoading(false);
          return;
        }
        setRole(data?.role ?? null);
        setRoleLoading(false);
      });
  }, [authLoading, isAuthenticated, user?.sub, retryCount]);

  useEffect(() => {
    if (authLoading || roleLoading || queryFailed) return;
    if (!isAuthenticated) {
      const path = window.location.pathname;
      if (SKIP_RETURN_PATHS.has(path)) {
        sessionStorage.removeItem("junni_return_to");
      } else {
        sessionStorage.setItem("junni_return_to", path + window.location.search);
      }
      setLocation("/");
    } else if (role !== "lender" && role !== "admin") {
      setLocation("/");
    }
  }, [authLoading, roleLoading, isAuthenticated, role, queryFailed]);

  if (authLoading || roleLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        Loading...
      </div>
    );
  }

  if (queryFailed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "Inter, sans-serif", gap: 12 }}>
        <div style={{ color: "#DC2626", fontSize: 14 }}>Could not verify your access. Please try again.</div>
        <button
          onClick={() => setRetryCount(c => c + 1)}
          style={{ background: "#1B2B4B", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!isAuthenticated || (role !== "lender" && role !== "admin")) {
    return null;
  }

  return <>{children}</>;
}
