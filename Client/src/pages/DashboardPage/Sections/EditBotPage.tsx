import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/services/supabase";
import { stagger, fadeUp } from "@/lib/animations";
import EditBotSection from "./EditBotSection";
import DemoChatSection from "./DemoChatSection";
import BusinessContentSection from "./BusinessContentSection";
import FaqSection from "./FaqSection";
import KnowledgeBaseSection from "./KnowledgeBaseSection";
import EditBotSidebar from "./EditBotSidebar";
import type { EditBotCategory } from "./EditBotSidebar";

export default function EditBotPage() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const [resetKey, setResetKey] = useState(0);
  const [activeCategory, setActiveCategory] =
    useState<EditBotCategory>("edit");

  const { data: workflow } = useQuery({
    queryKey: ["user-workflow", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflows")
        .select("id")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  const isEditTab = activeCategory === "edit";

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="px-3 py-5 sm:px-5 sm:py-6 md:px-8 md:py-8 max-w-7xl mx-auto"
    >
      {/* ── Centered hero ── */}
      <motion.div variants={fadeUp} className="text-center mb-6 sm:mb-8">
        <h1
          className="text-2xl sm:text-3xl md:text-[34px] font-bold text-[#0F172A] tracking-tight leading-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("editBotPageTitle")}
        </h1>
        <p className="text-[13px] sm:text-sm text-slate-500 font-medium mt-1.5 max-w-xl mx-auto">
          {t("editBotPageSubtitle")}
        </p>
      </motion.div>

      {/* ── Editor grid: nav on the right (RTL), edit middle, test-bot on the left.
            Mini-nav is source-first so RTL flow lands it on the right edge —
            mirroring the inspiration's visual placement. */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5"
      >
        <div className="lg:col-span-3">
          <EditBotSidebar
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </div>

        {isEditTab ? (
          <>
            <div className="lg:col-span-4 lg:h-[600px] flex flex-col">
              <EditBotSection
                onEditApplied={() => setResetKey((k) => k + 1)}
              />
            </div>
            <div className="lg:col-span-5 lg:h-[600px] flex flex-col">
              <DemoChatSection
                resetKey={resetKey}
                workflowId={workflow?.id}
              />
            </div>
          </>
        ) : (
          <div className="lg:col-span-9 min-w-0">
            {activeCategory === "content" && <BusinessContentSection />}
            {activeCategory === "faq" && <FaqSection />}
            {activeCategory === "knowledge-base" && <KnowledgeBaseSection />}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
