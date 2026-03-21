import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface DockItem {
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

interface CategoryDockProps {
  items: DockItem[];
  className?: string;
}

const floatingAnimation = {
  initial: { y: 0 },
  animate: {
    y: [-2, 2, -2],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

const DockIconButton = React.forwardRef<HTMLButtonElement, DockItem>(
  ({ icon: Icon, label, isActive, onClick }, ref) => (
    <motion.button
      type="button"
      ref={ref}
      whileHover={{ scale: 1.1, y: -2 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "relative group p-3 rounded-lg transition-colors cursor-pointer",
        isActive
          ? "bg-[#FF7E47]/10"
          : "hover:bg-[#FAF7F3]",
      )}
    >
      <Icon
        className={cn(
          "w-5 h-5 transition-colors",
          isActive ? "text-[#FF7E47]" : "text-[#7A7267] group-hover:text-[#2D2A26]",
        )}
      />
      {isActive && (
        <motion.span
          layoutId="dock-active-dot"
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#FF7E47]"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <span
        className={cn(
          "absolute -top-9 left-1/2 -translate-x-1/2",
          "px-2.5 py-1 rounded-lg text-xs font-medium",
          "bg-[#2D2A26] text-white",
          "opacity-0 group-hover:opacity-100",
          "transition-opacity duration-200 whitespace-nowrap pointer-events-none",
          "shadow-[0_2px_8px_rgba(45,42,38,0.2)]",
        )}
      >
        {label}
      </span>
    </motion.button>
  ),
);
DockIconButton.displayName = "DockIconButton";

export function CategoryDock({ items, className }: CategoryDockProps) {
  if (items.length < 2) return null;

  return (
    <div className={cn("w-full flex items-center justify-center py-4", className)}>
      <motion.div
        initial="initial"
        animate="animate"
        variants={floatingAnimation}
        className={cn(
          "flex items-center gap-1 p-2 rounded-2xl",
          "backdrop-blur-lg border shadow-lg",
          "bg-white/90 border-[#EDE6DD]/60",
          "shadow-[0_4px_24px_rgba(45,42,38,0.08)]",
          "hover:shadow-[0_6px_28px_rgba(45,42,38,0.12)] transition-shadow duration-300",
        )}
      >
        {items.map((item) => (
          <DockIconButton key={item.label} {...item} />
        ))}
      </motion.div>
    </div>
  );
}
