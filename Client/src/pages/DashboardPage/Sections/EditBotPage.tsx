import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/services/supabase";
import { stagger, fadeUp, contentVariants } from "@/lib/animations";
import EditBotSection from "./EditBotSection";
import DemoChatSection from "./DemoChatSection";
import BusinessContentSection from "./BusinessContentSection";
import FaqSection from "./FaqSection";
import KnowledgeBaseSection from "./KnowledgeBaseSection";
import EditBotSidebar from "./EditBotSidebar";
import type { EditBotCategory } from "./EditBotSidebar";

/* ── Animated wrapper to avoid repeating motion props per tab ── */
function AnimatedPanel({
  tabKey,
  children,
}: {
  tabKey: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      key={tabKey}
      variants={contentVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════ MAIN COMPONENT ════════════════════ */

export default function EditBotPage() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const [resetKey, setResetKey] = useState(0);
  const [activeCategory, setActiveCategory] =
    useState<EditBotCategory>("edit");

  // Fetch user's workflow for demo chat
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

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="px-3 py-5 sm:px-5 sm:py-5 md:p-8 max-w-7xl mx-auto space-y-6"
    >
      {/* ── Page Title ── */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2D2A26] tracking-tight">
          {t("editBotPageTitle")}
        </h1>
        <p className="text-sm text-[#7A7267] mt-0.5">
          {t("editBotPageSubtitle")}
        </p>
      </motion.div>

      {/* ── Sidebar + Content ── */}
      <motion.div variants={fadeUp} className="flex flex-col lg:flex-row gap-6">
        <EditBotSidebar
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />

        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeCategory === "edit" && (
              <AnimatedPanel tabKey="edit">
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-5">
                  <div className="lg:col-span-3">
                    <EditBotSection
                      onEditApplied={() => setResetKey((k) => k + 1)}
                    />
                  </div>
                  <div className="lg:col-span-4">
                    <DemoChatSection
                      resetKey={resetKey}
                      workflowId={workflow?.id}
                    />
                  </div>
                </div>
              </AnimatedPanel>
            )}

            {activeCategory === "content" && (
              <AnimatedPanel tabKey="content">
                <BusinessContentSection />
              </AnimatedPanel>
            )}

            {activeCategory === "faq" && (
              <AnimatedPanel tabKey="faq">
                <FaqSection />
              </AnimatedPanel>
            )}

            {activeCategory === "knowledge-base" && (
              <AnimatedPanel tabKey="knowledge-base">
                <KnowledgeBaseSection />
              </AnimatedPanel>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
