import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  Zap,
  BarChart3,
  Bot,
  Clock,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  { key: "feature1", icon: Zap },
  { key: "feature2", icon: MessageSquare },
  { key: "feature3", icon: BarChart3 },
  { key: "feature4", icon: Bot },
  { key: "feature5", icon: Clock },
  { key: "feature6", icon: Shield },
];

const FeaturesSection = () => {
  const { t } = useTranslation("landing");

  return (
    <section id="features" className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-[#FF6B2C] text-sm font-bold tracking-wider uppercase mb-3 block">
            {t("whyClix")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            {t("whyClixTitle")}
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            {t("whyClixDesc")}
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ key, icon: Icon }, index) => {
            const isLarge = index < 2;
            return (
              <div
                key={key}
                className={cn(
                  "rounded-xl border border-gray-200 bg-gray-50 p-6 hover:border-[#FF6B2C]/30 transition-colors relative overflow-hidden",
                  isLarge ? "col-span-2" : "col-span-2 sm:col-span-1"
                )}
              >
                {/* Orange accent bar at top */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#FF6B2C]/30 to-transparent" />

                <div className="w-10 h-10 rounded-full border border-[#FF6B2C]/30 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-[#FF6B2C]" />
                </div>
                <h3 className="text-gray-900 font-bold text-sm mb-1.5">{t(key)}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">
                  {t(`${key}Desc`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
