import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2, HelpCircle, Sparkles } from "lucide-react";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import { fadeUp } from "@/lib/animations";

interface FaqDraftEntry {
  id: string;
  question: string;
  answer: string;
  is_active: boolean;
  sort_order: number;
}

export default function FaqSection() {
  const { t } = useTranslation("faq");
  const { user } = useAuth();

  const [entries, setEntries] = useState<FaqDraftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Load entries: prefer draft_faq_entries from form_responses, fallback to faq_entries
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        // Check for draft first
        const { data: formRow, error: draftErr } = await supabase
          .from("form_responses")
          .select("draft_faq_entries")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!draftErr && formRow?.draft_faq_entries) {
          const raw = formRow.draft_faq_entries;
          const draft: FaqDraftEntry[] = typeof raw === "string" ? JSON.parse(raw) : (raw as unknown as FaqDraftEntry[]);
          setEntries(draft);
          setLoading(false);
          return;
        }

        // No draft — load from live faq_entries
        const { data, error: listErr } = await supabase
          .from("faq_entries")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true });

        if (listErr) throw listErr;

        setEntries(
          (data ?? []).map((e) => ({
            id: e.id,
            question: e.question ?? "",
            answer: e.answer ?? "",
            is_active: e.is_active ?? true,
            sort_order: e.sort_order ?? 0,
          })),
        );
      } catch {
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, t]);

  const updateField = (id: string, field: "question" | "answer", value: string) => {
    setEntries((prev) => prev.map((e) => (e.id !== id ? e : { ...e, [field]: value })));
    setDirty(true);
  };

  const toggleActive = (id: string) => {
    setEntries((prev) => prev.map((e) => (e.id !== id ? e : { ...e, is_active: !e.is_active })));
    setDirty(true);
  };

  const addEntry = () => {
    const nextOrder = entries.length > 0 ? Math.max(...entries.map((e) => e.sort_order)) + 1 : 0;
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        question: "",
        answer: "",
        is_active: true,
        sort_order: nextOrder,
      },
    ]);
    setDirty(true);
  };

  const deleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);

    try {
      const draftData = entries.map((e, idx) => ({
        question: e.question,
        answer: e.answer,
        is_active: e.is_active,
        sort_order: idx,
      }));

      const { error: updateErr } = await supabase
        .from("form_responses")
        .update({ draft_faq_entries: draftData as unknown as string })
        .eq("user_id", user.id);

      if (updateErr) throw updateErr;

      // Publish without query invalidation to avoid AnimatePresence DOM conflict
      await supabase.rpc("publish_bot_changes", { p_user_id: user.id });
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
        <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary-light)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Table */}
      <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[40px_1fr_1fr_64px_48px] gap-3 px-5 py-3 bg-[#FAF7F3] border-b border-[#EDE6DD]/60 text-xs font-bold text-[#7A7267] uppercase tracking-wider">
          <span>#</span>
          <span>{t("question")}</span>
          <span>{t("answer")}</span>
          <span className="text-center">{t("active")}</span>
          <span />
        </div>

        {/* Entries */}
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              className="grid grid-cols-[40px_1fr_1fr_64px_48px] gap-3 px-5 py-3 border-b border-[#EDE6DD]/30 items-center group"
            >
              {/* Row number */}
              <span className="text-xs text-[#A39B90] font-mono">{idx + 1}</span>

              {/* Question */}
              <input
                type="text"
                value={entry.question}
                onChange={(e) => updateField(entry.id, "question", e.target.value)}
                placeholder={t("questionPlaceholder")}
                className="w-full px-3 py-2 rounded-lg border border-transparent hover:border-[#EDE6DD] focus:border-[var(--brand-primary-light)]/40 focus:ring-2 focus:ring-[var(--brand-primary-light)]/20 bg-transparent text-sm text-[#2D2A26] placeholder-[#C5BDB4] transition-all outline-none"
              />

              {/* Answer */}
              <input
                type="text"
                value={entry.answer}
                onChange={(e) => updateField(entry.id, "answer", e.target.value)}
                placeholder={t("answerPlaceholder")}
                className="w-full px-3 py-2 rounded-lg border border-transparent hover:border-[#EDE6DD] focus:border-[var(--brand-primary-light)]/40 focus:ring-2 focus:ring-[var(--brand-primary-light)]/20 bg-transparent text-sm text-[#2D2A26] placeholder-[#C5BDB4] transition-all outline-none"
              />

              {/* Active toggle */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => toggleActive(entry.id)}
                  className={`w-10 h-5.5 rounded-full relative transition-colors duration-200 cursor-pointer ${
                    entry.is_active ? "bg-[var(--brand-primary-light)]" : "bg-[#D9D4CE]"
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
                type="button"
                onClick={() => deleteEntry(entry.id)}
                className="p-1.5 rounded-lg text-[#C5BDB4] hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

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
            type="button"
            onClick={addEntry}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--brand-primary-light)] hover:bg-[var(--brand-primary-light)]/10 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t("addRow")}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3.5 text-sm mt-6">
          {error}
        </div>
      )}

      {/* Success feedback */}
      {saved && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-5 py-3.5 text-sm mt-6">
          {t("changesSaved")}
        </div>
      )}

      {/* Save Draft Button */}
      {entries.length > 0 && (
        <motion.div variants={fadeUp} className="flex justify-center pt-6 pb-4">
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            whileHover={dirty ? { scale: 1.02 } : {}}
            whileTap={dirty ? { scale: 0.98 } : {}}
            className={`group relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 font-bold text-base rounded-2xl px-10 py-4 transition-all duration-300 ${
              dirty
                ? "bg-[var(--brand-primary-light)] hover:brightness-90 text-white shadow-[0_4px_20px_rgba(var(--brand-primary-rgb),0.3)] hover:shadow-[0_6px_28px_rgba(var(--brand-primary-rgb),0.4)]"
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
    </div>
  );
}
