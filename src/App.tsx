import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import LenderRoute from "./components/LenderRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import RoleSelect from "./pages/RoleSelect";
import BorrowerOnboarding from "./pages/BorrowerOnboarding";
import LenderOnboarding from "./pages/LenderOnboarding";
import BorrowerDashboard from "./pages/BorrowerDashboard";
import Marketplace from "./pages/Marketplace";
import DealDetail from "./pages/DealDetail";
import LenderDashboard from "./pages/LenderDashboard";
import LenderPortfolio from "./pages/LenderPortfolio";
import FinancialReview from "./pages/FinancialReview";
import AdminPanel from "./pages/AdminPanel";
import DealAnalysis from "./pages/DealAnalysis";
import NewAnalysis from "./pages/NewAnalysis";
import MyAnalyses from "./pages/MyAnalyses";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import { setSupabaseAuthToken } from './lib/supabase'


function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation(to); }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"}>
        <Redirect to="/login" />
      </Route>
      <Route path={"/login"} component={Login} />
      <Route path={"/role-select"} component={RoleSelect} />
      <Route path={"/marketplace"}>
        <Redirect to="/lender-dashboard" />
      </Route>
      <Route path={"/deals/:id"}>
        <Redirect to="/lender-dashboard" />
      </Route>
      <Route path={"/deals/:id/review-financials"}>
        <Redirect to="/lender-dashboard" />
      </Route>
      <Route path={"/privacy"} component={PrivacyPolicy} />
      <Route path={"/terms"} component={TermsOfService} />
      <Route path={"/onboarding"}>
        <Redirect to="/lender-dashboard" />
      </Route>
      <Route path={"/lender-onboarding"}>
        <Redirect to="/lender-dashboard" />
      </Route>
      <Route path={"/borrower-dashboard"}>
        <Redirect to="/lender-dashboard" />
      </Route>
      <Route path={"/lender-dashboard"}>
        <ProtectedRoute>
          <LenderDashboard />
        </ProtectedRoute>
      </Route>
      <Route path={"/lender-portfolio"}>
        <Redirect to="/lender-dashboard" />
      </Route>
      <Route path={"/admin"}>
        <AdminRoute>
          <AdminPanel />
        </AdminRoute>
      </Route>
      <Route path={"/new-analysis"}>
        <LenderRoute>
          <NewAnalysis />
        </LenderRoute>
      </Route>
      <Route path={"/my-analyses"}>
        <LenderRoute>
          <MyAnalyses />
        </LenderRoute>
      </Route>
      <Route path={"/analysis/:dealId"}>
        <LenderRoute>
          <DealAnalysis />
        </LenderRoute>
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  const { isAuthenticated, getIdTokenClaims } = useAuth0();

  useEffect(() => {
    if (isAuthenticated) {
      getIdTokenClaims().then(claims => {
        setSupabaseAuthToken(claims?.__raw ?? null);
      });
    } else {
      setSupabaseAuthToken(null);
    }
  }, [isAuthenticated, getIdTokenClaims]);
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
