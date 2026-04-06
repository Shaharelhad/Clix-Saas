import { useTenantStore } from "@/store/tenant.store";

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

export default function BrandLogo({ className = "h-8", alt }: BrandLogoProps) {
  const config = useTenantStore((s) => s.config);
  const src = config?.logoUrl || "/clix-logo-full.png";
  const altText = alt || config?.name || "Logo";

  return <img src={src} alt={altText} className={className} />;
}
