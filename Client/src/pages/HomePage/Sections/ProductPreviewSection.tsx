import { useTranslation } from "react-i18next";
import { Eye, Sparkles, HelpCircle, Workflow } from "lucide-react";

const ProductPreviewSection = () => {
  const { t } = useTranslation("landing");
  const sidebarItems = t("mockSidebar", { returnObjects: true }) as string[];
  const btnLabels = t("mockBtnLabels", { returnObjects: true }) as string[];

  const sidebarIcons = [Eye, Sparkles, HelpCircle, Sparkles, Workflow];

  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          {t("howItWorks")}
        </h2>
        <p className="text-white/50 text-lg">{t("automationInMinutes")}</p>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="rounded-2xl border border-white/[0.08] bg-black overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.08] bg-white/[0.03]">
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="text-white/30 text-xs mr-4">CLIX Dashboard</span>
          </div>

          <div className="flex min-h-[350px]">
            {/* Sidebar */}
            <div className="hidden sm:flex flex-col w-48 border-l border-white/[0.08] bg-white/[0.03] p-3 gap-1">
              {sidebarItems.map((label, i) => {
                const Icon = sidebarIcons[i] ?? Sparkles;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      i === 4
                        ? "bg-[#FF6B2C]/15 text-[#FF6B2C]"
                        : "text-white/40 hover:text-white/60 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </div>
                );
              })}
            </div>

            {/* Canvas area */}
            <div className="flex-1 p-6 relative">
              {/* Mock flow nodes */}
              <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 justify-center h-full">
                {/* Start node */}
                <div className="flex flex-col items-center">
                  <div className="w-28 rounded-xl border border-white/20 bg-white/[0.06] p-3 text-center">
                    <div className="text-[10px] text-white/40 mb-1">
                      {t("mockStart")}
                    </div>
                    <div className="text-xs text-white/70">שלום</div>
                  </div>
                  <div className="w-px h-6 bg-white/10 sm:hidden" />
                </div>

                {/* Connector */}
                <div className="hidden sm:block w-10 h-px bg-white/10" />

                {/* Text node */}
                <div className="flex flex-col items-center">
                  <div className="w-36 rounded-xl border border-white/15 bg-white/[0.04] p-3 text-center">
                    <div className="text-[10px] text-white/40 mb-1">
                      {t("mockTextMessage")}
                    </div>
                    <div className="text-xs text-white/70">
                      {t("mockGreeting")}
                    </div>
                  </div>
                  <div className="w-px h-6 bg-white/10 sm:hidden" />
                </div>

                {/* Connector */}
                <div className="hidden sm:block w-10 h-px bg-white/10" />

                {/* Buttons node — orange accent (active) */}
                <div className="flex flex-col items-center">
                  <div className="w-36 rounded-xl border border-[#FF6B2C]/30 bg-[#FF6B2C]/10 p-3 text-center">
                    <div className="text-[10px] text-[#FF6B2C]/60 mb-1">
                      {t("mockButtons")}
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      {btnLabels.map((label, i) => (
                        <div
                          key={i}
                          className="text-[10px] text-white/50 bg-white/5 rounded px-2 py-0.5"
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductPreviewSection;
