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

  const active = categories.find((c) => c.id === activeCategory) ?? categories[0];
  const inactive = categories.filter((c) => c.id !== activeCategory);
  const ActiveIcon = active.icon;

  return (
    <>
      {/* ── Desktop / tablet: stacked card mini-nav ── */}
      <nav className="hidden lg:flex lg:sticky lg:top-24 flex-col gap-3">
        {/* Active card — thick brand border framing an inner brand-light pill */}
        <motion.div
          layout
          className="bg-white rounded-2xl border-2 border-[var(--brand-primary)] p-1 shadow-[0_6px_24px_-12px_rgba(255,107,44,0.35)]"
        >
          <button
            type="button"
            aria-current="page"
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-[var(--brand-primary)]/8 cursor-default"
            style={{ background: "rgba(var(--brand-primary-rgb), 0.08)" }}
          >
            <span className="text-sm font-bold text-[var(--brand-primary)] tracking-tight">
              {t(active.labelKey)}
            </span>
            <ActiveIcon className="w-[18px] h-[18px] text-[var(--brand-primary)]" />
          </button>
        </motion.div>

        {/* Inactive list card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-[0_2px_18px_-10px_rgba(15,23,42,0.06)]">
          <ul className="flex flex-col gap-0.5">
            {inactive.map((cat) => {
              const Icon = cat.icon;
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onCategoryChange(cat.id)}
                    className="group w-full flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
                  >
                    <span className="text-sm font-medium text-slate-500 group-hover:text-slate-900 transition-colors">
                      {t(cat.labelKey)}
                    </span>
                    <Icon className="w-[18px] h-[18px] text-slate-400 group-hover:text-slate-700 transition-colors" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* ── Mobile: horizontal pill tabs ── */}
      <nav className="lg:hidden">
        <div className="flex gap-1.5 overflow-x-auto bg-white rounded-2xl shadow-[0_2px_18px_-10px_rgba(15,23,42,0.08)] border border-slate-200 p-1.5">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            const Icon = cat.icon;

            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors duration-200 cursor-pointer ${
                  isActive
                    ? "text-[var(--brand-primary)] font-bold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="editbot-mininav-active-mobile"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: "rgba(var(--brand-primary-rgb), 0.1)" }}
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
