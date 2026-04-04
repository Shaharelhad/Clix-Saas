import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { initTenant } from "@/lib/tenant";
import "@/i18n";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Initialize tenant before rendering React to avoid flash of wrong branding (FOUB)
initTenant().then(() => {
  const root = document.getElementById("root")!;
  root.style.opacity = "1"; // Reveal after tenant branding is applied
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </QueryClientProvider>
    </StrictMode>,
  );
});
