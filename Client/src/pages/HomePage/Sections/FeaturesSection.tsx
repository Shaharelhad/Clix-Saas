import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  Zap,
  BarChart3,
  Bot,
  Clock,
  Shield,
} from "lucide-react";

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
    <section id="features" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-[#FF7E47] text-sm font-bold tracking-wider uppercase mb-3 block">
            {t("whyClix")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {t("whyClixTitle")}
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            {t("whyClixDesc")}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Features grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="rounded-xl border border-white/10 bg-white/5 p-5 hover:border-[#FF7E47]/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#FF7E47]/15 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-[#FF7E47]" />
                </div>
                <h3 className="text-white font-bold text-sm mb-1">{t(key)}</h3>
                <p className="text-white/40 text-xs leading-relaxed">
                  {t(`${key}Desc`)}
                </p>
              </div>
            ))}
          </div>

          {/* WhatsApp chat mockup */}
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#075e54]">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-white text-sm font-medium">
                  {t("chatMockTitle")}
                </div>
                <div className="text-green-300/70 text-[10px]">CLIX Bot</div>
              </div>
            </div>

            {/* Chat body */}
            <div
              className="p-4 space-y-3 min-h-[280px]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            >
              {/* User message 1 */}
              <div className="flex justify-start">
                <div className="bg-white/10 rounded-2xl rounded-br-md px-4 py-2 max-w-[75%]">
                  <p className="text-white/80 text-sm">{t("chatUser1")}</p>
                </div>
              </div>

              {/* Bot response 1 */}
              <div className="flex justify-end">
                <div className="bg-[#005c4b] rounded-2xl rounded-bl-md px-4 py-2 max-w-[75%]">
                  <p className="text-white/90 text-sm">{t("chatBot1")}</p>
                </div>
              </div>

              {/* User message 2 */}
              <div className="flex justify-start">
                <div className="bg-white/10 rounded-2xl rounded-br-md px-4 py-2 max-w-[75%]">
                  <p className="text-white/80 text-sm">{t("chatUser2")}</p>
                </div>
              </div>

              {/* Bot response 2 */}
              <div className="flex justify-end">
                <div className="bg-[#005c4b] rounded-2xl rounded-bl-md px-4 py-2 max-w-[75%]">
                  <p className="text-white/90 text-sm">{t("chatBot2")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
