import { useTenantStore } from "@/store/tenant.store";

interface BrandLogoProps {
  className?: string;
  alt?: string;
}

export default function BrandLogo({ className = "h-8", alt }: BrandLogoProps) {
  const config = useTenantStore((s) => s.config);
  const altText = alt || config?.name || "Logo";

  // Default CLIX tenant: always use the bundled brand asset.
  if (!config || config.slug === "clix") {
    return <img src="/clix-logo-full.png" alt={altText} className={className} />;
  }

  // White-label tenant with uploaded logo.
  if (config.logoUrl) {
    return <img src={config.logoUrl} alt={altText} className={className} />;
  }

  // White-label tenant without a logo: render their name as wordmark.
  return (
    <h1
      className="text-2xl font-black tracking-tighter text-zinc-900"
      style={{ fontFamily: "var(--font-display)" }}
    >
      {config.name}
    </h1>
  );
}
