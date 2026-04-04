import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { isMainDomain } from "@/lib/tenant";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, isAdmin, hasCompletedOnboarding } = useAuth();

  // Admin panel only available on the main domain, not tenant subdomains
  if (!isMainDomain()) return <Navigate to="/" replace />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to={hasCompletedOnboarding ? "/dashboard" : "/create-bot"} replace />;

  return <>{children}</>;
}
