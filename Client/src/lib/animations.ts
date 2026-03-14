/**
 * Shared Framer Motion animation variants used across pages/sections.
 * Import from "@/lib/animations" instead of redefining per file.
 */

export const EASE = [0.22, 1, 0.36, 1] as const;

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
} as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
} as const;

export const contentVariants = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: EASE } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.15 } },
} as const;
