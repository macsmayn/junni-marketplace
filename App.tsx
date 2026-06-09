import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import RoleSelect from "./pages/RoleSelect";
import BorrowerOnboarding from "./pages/BorrowerOnboarding";
import BorrowerDashboard from "./pages/BorrowerDashboard";
import Marketplace from "./pages/Marketplace";
import DealDetail from "./pages/DealDetail";
import LenderDashboard from "./pages/LenderDashboard";
import LenderPortfolio from "./pages/LenderPortfolio";
import AdminPanel from "./pages/AdminPanel";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import { supabase } from './lib/supabase'


function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/role-select"} component={RoleSelect} />
      <Route path={"/marketplace"} component={Marketplace} />
      <Route path={"/deals/:id"} component={DealDetail} />
      <Route path={"/privacy"} component={PrivacyPolicy} />
      <Route path={"/terms"} component={TermsOfService} />
      <Route path={"/onboarding"}>
        <ProtectedRoute>
          <BorrowerOnboarding />
        </ProtectedRoute>
      </Route>
      <Route path={"/borrower-dashboard"}>
        <ProtectedRoute>
          <BorrowerDashboard />
        </ProtectedRoute>
      </Route>
      <Route path={"/lender-dashboard"}>
        <ProtectedRoute>
          <LenderDashboard />
        </ProtectedRoute>
      </Route>
      <Route path={"/lender-portfolio"}>
        <ProtectedRoute>
          <LenderPortfolio />
        </ProtectedRoute>
      </Route>
      <Route path={"/admin"}>
        <ProtectedRoute>
          <AdminPanel />
        </ProtectedRoute>
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
  console.log('Supabase client initialized:', !!supabase)
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
