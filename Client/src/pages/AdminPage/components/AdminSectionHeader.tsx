import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export type AdminSectionHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  align?: "between" | "stack";
  className?: string;
};

export default function AdminSectionHeader({
  title,
  subtitle,
  actions,
  icon: Icon,
  align = "between",
  className,
}: AdminSectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={cn(
        "shrink-0",
        align === "between"
          ? "flex justify-between items-end gap-4"
          : "flex flex-col gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl md:text-2xl font-bold tracking-tight text-[#111111] leading-tight">
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] shrink-0"
          />
          {Icon && (
            <Icon
              aria-hidden
              className="w-5 h-5 text-[var(--brand-primary)] shrink-0"
            />
          )}
          <span className="truncate">{title}</span>
        </h1>
        {subtitle && (
          <p className="text-xs text-[#999999] font-light mt-0.5 ms-3.5">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </motion.div>
  );
}
