import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Role landing pages and auth-flow pages must never be saved as a return
// destination — returning to them bypasses RoleSelect's role-based routing.
const SKIP_RETURN_PATHS = new Set([
  "/", "/login", "/role-select",
  "/lender-dashboard", "/admin", "/borrower-dashboard", "/complete-profile",
]);

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth0();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const path = window.location.pathname;
      if (SKIP_RETURN_PATHS.has(path)) {
        sessionStorage.removeItem("junni_return_to");
      } else {
        sessionStorage.setItem("junni_return_to", path + window.location.search);
      }
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
