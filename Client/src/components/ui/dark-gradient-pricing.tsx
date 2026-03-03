import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Benefit {
  text: string;
  included: boolean;
}

interface PricingCardProps {
  tier: string;
  price: string;
  period?: string;
  bestFor: string;
  cta: string;
  benefits: Benefit[];
  popular?: boolean;
  onSelect?: () => void;
}

export function PricingCard({
  tier,
  price,
  period,
  bestFor,
  cta,
  benefits,
  popular = false,
  onSelect,
}: PricingCardProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, filter: "blur(10px)" }}
      animate={inView ? { opacity: 1, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.6, delay: 0.25 }}
      className={cn(
        "relative flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 sm:p-8",
        popular && "ring-2 ring-[#FF7E47] border-[#FF7E47]/30"
      )}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#FF7E47] text-white text-xs font-bold">
          הכי פופולרי
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-bold text-white mb-1">{tier}</h3>
        <p className="text-white/60 text-sm">{bestFor}</p>
      </div>

      <div className="mb-6">
        <span className="text-4xl font-bold text-white">{price}</span>
        {period && <span className="text-white/50 text-sm mr-1">{period}</span>}
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {benefits.map((b, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm">
            {b.included ? (
              <div className="w-5 h-5 rounded-full bg-[#FF7E47]/20 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-[#FF7E47]" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                <X className="w-3 h-3 text-white/30" />
              </div>
            )}
            <span className={b.included ? "text-white/80" : "text-white/30"}>
              {b.text}
            </span>
          </li>
        ))}
      </ul>

      <button
        onClick={onSelect}
        className={cn(
          "w-full py-3 rounded-xl font-bold text-sm transition-all",
          popular
            ? "bg-[#FF7E47] text-white hover:bg-[#FF7E47]/90 hover:scale-[1.02]"
            : "bg-white/10 text-white hover:bg-white/15 hover:scale-[1.02]"
        )}
      >
        {cta}
      </button>
    </motion.div>
  );
}
