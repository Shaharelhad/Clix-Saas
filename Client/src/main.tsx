import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { initTenant } from "@/lib/tenant";
import "@/i18n";
import "@/index.css";

// Patch DOM methods to handle Google Translate (and similar extensions) that
// modify text nodes. Without this, React's removeChild/insertBefore fails
// because the translated <font> wrappers move text nodes out of place.
// See: https://github.com/facebook/react/issues/11538
if (typeof Node !== "undefined") {
  const origRemoveChild = Node.prototype.removeChild;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (child.parentNode) return child.parentNode.removeChild(child);
      return child;
    }
    return origRemoveChild.call(this, child) as T;
  };

  const origInsertBefore = Node.prototype.insertBefore;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, refNode: Node | null): T {
    if (refNode && refNode.parentNode !== this) {
      return newNode;
    }
    return origInsertBefore.call(this, newNode, refNode) as T;
  };
}

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
