import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Loader2, HelpCircle, Check, AlertCircle, Sparkles } from "lucide-react";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/types/database";

type FaqEntry = Tables<"faq_entries">;

const EASE = [0.22, 1, 0.36, 1] as const;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

export default function FaqSection() {
  const { t } = useTranslation("faq");
  const { user } = useAuth();

  const [entries, setEntries] = useState<FaqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Fetch entries
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("faq_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true });
      setEntries(data ?? []);
      setLoading(false);
    })();
  }, [user?.id]);

  const updateField = (id: string, field: "question" | "answer", value: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id !== id ? e : { ...e, [field]: value }))
    );
    setDirty(true);
  };

  const toggleActive = (id: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id !== id ? e : { ...e, is_active: !e.is_active }))
    );
    setDirty(true);
  };

  const addEntry = async () => {
    if (!user?.id) return;
    const nextOrder = entries.length > 0 ? Math.max(...entries.map((e) => e.sort_order ?? 0)) + 1 : 0;
    const { data, error: insertErr } = await supabase
      .from("faq_entries")
      .insert({ user_id: user.id, question: "", answer: "", sort_order: nextOrder, is_active: true })
      .select()
      .single();

    if (insertErr || !data) {
      setError(t("saveError"));
      return;
    }
    setEntries((prev) => [...prev, data]);
  };

  const deleteEntry = async (id: string) => {
    const { error: delErr } = await supabase.from("faq_entries").delete().eq("id", id);
    if (delErr) {
      setError(t("deleteError"));
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      for (const entry of entries) {
        const { error: updateErr } = await supabase
          .from("faq_entries")
          .update({
            question: entry.question,
            answer: entry.answer,
            is_active: entry.is_active,
          })
          .eq("id", entry.id);

        if (updateErr) throw updateErr;
      }

      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF7E47]" />
      </div>
    );
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="p-5 sm:p-8 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2D2A26] tracking-tight">
          {t("title")}
        </h1>
        <p className="text-sm text-[#7A7267] mt-1">{t("subtitle")}</p>
      </motion.div>

      {/* Table */}
      <motion.div
        variants={fadeUp}
        className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50 overflow-hidden"
      >
        {/* Table Header */}
        <div className="grid grid-cols-[40px_1fr_1fr_64px_48px] gap-3 px-5 py-3 bg-[#FAF7F3] border-b border-[#EDE6DD]/60 text-xs font-bold text-[#7A7267] uppercase tracking-wider">
          <span>#</span>
          <span>{t("question")}</span>
          <span>{t("answer")}</span>
          <span className="text-center">{t("active")}</span>
          <span />
        </div>

        {/* Entries */}
        <AnimatePresence mode="popLayout">
          {entries.map((entry, idx) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="grid grid-cols-[40px_1fr_1fr_64px_48px] gap-3 px-5 py-3 border-b border-[#EDE6DD]/30 items-center group"
            >
              {/* Row number */}
              <span className="text-xs text-[#A39B90] font-mono">
                {idx + 1}
              </span>

              {/* Question */}
              <input
                type="text"
                value={entry.question ?? ""}
                onChange={(e) => updateField(entry.id, "question", e.target.value)}
                placeholder={t("questionPlaceholder")}
                className="w-full px-3 py-2 rounded-lg border border-transparent hover:border-[#EDE6DD] focus:border-[#FF7E47]/40 focus:ring-2 focus:ring-[#FF7E47]/20 bg-transparent text-sm text-[#2D2A26] placeholder-[#C5BDB4] transition-all outline-none"
              />

              {/* Answer */}
              <input
                type="text"
                value={entry.answer ?? ""}
                onChange={(e) => updateField(entry.id, "answer", e.target.value)}
                placeholder={t("answerPlaceholder")}
                className="w-full px-3 py-2 rounded-lg border border-transparent hover:border-[#EDE6DD] focus:border-[#FF7E47]/40 focus:ring-2 focus:ring-[#FF7E47]/20 bg-transparent text-sm text-[#2D2A26] placeholder-[#C5BDB4] transition-all outline-none"
              />

              {/* Active toggle */}
              <div className="flex justify-center">
                <button
                  onClick={() => toggleActive(entry.id)}
                  className={`w-10 h-5.5 rounded-full relative transition-colors duration-200 cursor-pointer ${
                    entry.is_active ? "bg-[#FF7E47]" : "bg-[#D9D4CE]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                      entry.is_active ? "right-0.5" : "right-[calc(100%-1.25rem)]"
                    }`}
                  />
                </button>
              </div>

              {/* Delete */}
              <button
                onClick={() => deleteEntry(entry.id)}
                className="p-1.5 rounded-lg text-[#C5BDB4] hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <HelpCircle className="w-10 h-10 text-[#D9D4CE] mb-3" />
            <p className="text-sm text-[#7A7267] font-medium">{t("noQuestionsYet")}</p>
            <p className="text-xs text-[#A39B90] mt-1">{t("clickAddToStart")}</p>
          </div>
        )}

        {/* Add Row Button */}
        <div className="px-5 py-3 border-t border-[#EDE6DD]/40">
          <button
            onClick={addEntry}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[#FF7E47] hover:bg-[#FF7E47]/10 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t("addRow")}
          </button>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3.5 text-sm mt-6"
        >
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
          {error}
        </motion.div>
      )}

      {/* Success feedback */}
      {saved && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-5 py-3.5 text-sm mt-6"
        >
          <Check className="w-4.5 h-4.5 flex-shrink-0" />
          {t("savedSuccessfully")}
        </motion.div>
      )}

      {/* Save Button */}
      {entries.length > 0 && (
        <motion.div variants={fadeUp} className="flex justify-center pt-6 pb-4">
          <motion.button
            onClick={handleSave}
            disabled={saving || !dirty}
            whileHover={dirty ? { scale: 1.02 } : {}}
            whileTap={dirty ? { scale: 0.98 } : {}}
            className={`group relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 font-bold text-base rounded-2xl px-10 py-4 transition-all duration-300 ${
              dirty
                ? "bg-[#FF7E47] hover:bg-[#E86B38] text-white shadow-[0_4px_20px_rgba(255,126,71,0.3)] hover:shadow-[0_6px_28px_rgba(255,126,71,0.4)]"
                : "bg-[#EDE6DD] text-[#A39B90] cursor-not-allowed"
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                {t("saving")}
              </>
            ) : (
              <>
                {t("saveChanges")}
                <Sparkles className="w-4.5 h-4.5 transition-transform group-hover:rotate-12" />
              </>
            )}
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
