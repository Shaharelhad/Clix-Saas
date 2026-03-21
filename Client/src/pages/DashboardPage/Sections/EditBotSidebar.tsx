import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sparkles, FileText, HelpCircle, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type EditBotCategory = "edit" | "content" | "faq" | "knowledge-base";

interface EditBotSidebarProps {
  activeCategory: EditBotCategory;
  onCategoryChange: (category: EditBotCategory) => void;
}

interface CategoryItem {
  id: EditBotCategory;
  icon: LucideIcon;
  labelKey: string;
}

const categories: CategoryItem[] = [
  { id: "edit", icon: Sparkles, labelKey: "editBot" },
  { id: "content", icon: FileText, labelKey: "businessContent" },
  { id: "faq", icon: HelpCircle, labelKey: "faq" },
  { id: "knowledge-base", icon: BookOpen, labelKey: "knowledgeBase" },
];

export default function EditBotSidebar({
  activeCategory,
  onCategoryChange,
}: EditBotSidebarProps) {
  const { t } = useTranslation("sidebar");

  return (
    <>
      {/* ── Desktop: vertical sidebar ── */}
      <nav className="hidden lg:block w-56 shrink-0 sticky top-24 self-start">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50 p-2.5 flex flex-col gap-1">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            const Icon = cat.icon;

            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={`
                  relative flex items-center gap-3 w-full rounded-xl px-4 py-3
                  text-sm font-medium transition-colors duration-200 cursor-pointer
                  ${
                    isActive
                      ? "text-[#FF7E47] font-bold"
                      : "text-[#7A7267] hover:bg-[#FAF7F3] hover:text-[#2D2A26]"
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-gradient-to-l from-[#FF7E47]/10 to-[#FF7E47]/5 border-e-[3px] border-[#FF7E47]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="relative z-10 w-[18px] h-[18px] shrink-0" />
                <span className="relative z-10">{t(cat.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Mobile: horizontal pill tabs ── */}
      <nav className="lg:hidden">
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto bg-white/80 backdrop-blur-sm rounded-xl shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50 p-1.5 sm:p-2">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            const Icon = cat.icon;

            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={`
                  relative flex items-center gap-2 rounded-xl px-4 py-2.5
                  text-sm whitespace-nowrap transition-colors duration-200 cursor-pointer
                  ${
                    isActive
                      ? "text-[#FF7E47] font-bold"
                      : "text-[#7A7267] hover:bg-[#FAF7F3] hover:text-[#2D2A26]"
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-mobile"
                    className="absolute inset-0 rounded-xl bg-[#FF7E47]/10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="relative z-10 w-4 h-4 shrink-0" />
                <span className="relative z-10">{t(cat.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
