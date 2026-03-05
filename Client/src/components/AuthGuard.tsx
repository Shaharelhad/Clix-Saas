import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, isPending } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(170deg, #FDF8F2 0%, #F8F0E6 40%, #FBF5EE 100%)" }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#FF7E47]" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (isPending) return <Navigate to="/pending" replace />;

  return <>{children}</>;
}
