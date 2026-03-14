import { motion } from "framer-motion";
import { Check, AlertCircle } from "lucide-react";

interface FeedbackBannerProps {
  variant: "error" | "success";
  message: string;
  className?: string;
}

const config = {
  error: {
    colors: "bg-red-50 border border-red-200 text-red-700",
    Icon: AlertCircle,
  },
  success: {
    colors: "bg-emerald-50 border border-emerald-200 text-emerald-700",
    Icon: Check,
  },
} as const;

export default function FeedbackBanner({
  variant,
  message,
  className = "",
}: FeedbackBannerProps) {
  const { colors, Icon } = config[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 ${colors} rounded-xl px-5 py-3.5 text-sm ${className}`}
    >
      <Icon className="w-4.5 h-4.5 flex-shrink-0" />
      {message}
    </motion.div>
  );
}
