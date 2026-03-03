import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  id: string;
  icon: ReactNode;
}

interface AnimeNavBarProps {
  items: NavItem[];
  defaultActive?: string;
  activeItem?: string;
  onItemClick?: (id: string) => void;
  className?: string;
}

export function AnimeNavBar({
  items,
  defaultActive,
  activeItem,
  onItemClick,
  className,
}: AnimeNavBarProps) {
  const [active, setActive] = useState(defaultActive ?? items[0]?.name ?? "");
  const [hovered, setHovered] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (activeItem !== undefined) setActive(activeItem);
  }, [activeItem]);

  const current = hovered ?? active;

  return (
    <nav
      className={cn(
        "relative flex items-center gap-1 rounded-full border border-white/10 bg-black/50 backdrop-blur-md px-1 py-1 overflow-visible",
        className
      )}
    >
      {items.map((item) => {
        const isActive = current === item.name;
        return (
          <button
            key={item.name}
            onMouseEnter={() => setHovered(item.name)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => {
              setActive(item.name);
              onItemClick?.(item.id);
            }}
            className={cn(
              "relative px-3 py-2 text-sm font-medium transition-colors rounded-full",
              isActive ? "text-white" : "text-white/60 hover:text-white/80"
            )}
          >
            {/* Background glow */}
            <AnimatePresence>
              {isActive && (
                <motion.div
                  layoutId="nav-glow"
                  className="absolute inset-0 rounded-full bg-[#FFB347]/15"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </AnimatePresence>

            {/* Floating brand logo — below the nav */}
            <AnimatePresence>
              {isActive && (
                <motion.div
                  layoutId="anime-mascot"
                  className="absolute -bottom-10 left-1/2 -translate-x-1/2 pointer-events-none"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  {/* Stem pointing up */}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#2D3139] rotate-45" />
                  <img
                    src="/clix-favicon.svg"
                    alt=""
                    aria-hidden="true"
                    className="w-7 h-7 drop-shadow-[0_0_6px_rgba(255,126,71,0.4)]"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <span className="relative z-10 flex items-center gap-1.5">
              {item.icon}
              {!isMobile && item.name}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
