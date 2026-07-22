import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import { useLocation } from "wouter";
import App from "./App";
import "./index.css";

function Auth0ProviderWithHistory({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  const onRedirectCallback = (appState: any) => {
    setLocation(appState?.returnTo || "/role-select");
  };

  return (
    <Auth0Provider
      domain="junnifinance.ca.auth0.com"
      clientId="kg5ge4gsb4cPkZIrxeF0wxRNYXO8IzYX"
      authorizationParams={{
        redirect_uri: window.location.origin + "/role-select",
        audience: "https://junni-market-2.manus.space"
      }}
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <Auth0ProviderWithHistory>
    <App />
  </Auth0ProviderWithHistory>
);
