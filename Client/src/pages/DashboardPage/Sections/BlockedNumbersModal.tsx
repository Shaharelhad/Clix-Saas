import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, ShieldOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

/* ── Phone normalization ── */

/**
 * Normalize any phone input to a consistent format with + prefix.
 * Handles common shorthand inputs:
 *   09XXXXXXXXX  → +639XXXXXXXXX  (PH local)
 *   639XXXXXXXXX → +639XXXXXXXXX  (PH international without +)
 *   05XXXXXXXX   → +9725XXXXXXXX  (IL local)
 *   972XXXXXXXX  → +972XXXXXXXX   (IL international without +)
 *   +XXXXXXXXXXX → +XXXXXXXXXXX   (already international)
 * Returns null if fewer than 7 digits.
 */
function normalizePhone(input: string): string | null {
  // Strip spaces, dashes, parens
  const cleaned = input.replace(/[\s\-()]/g, "");

  // Already has + prefix — keep as-is
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1).replace(/\D/g, "");
    return digits.length >= 7 ? "+" + digits : null;
  }

  // Strip any remaining non-digit chars
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 7) return null;

  // Israeli local: 05... → +972 5...
  if (digits.startsWith("05") && digits.length >= 9) {
    return "+972" + digits.slice(1);
  }

  // Philippine local: 09... → +63 9...
  if (digits.startsWith("09") && digits.length >= 10) {
    return "+63" + digits.slice(1);
  }

  // If starts with a known country code without +, add +
  // (972, 63, 1, 44, etc. — any raw digits that look international)
  return "+" + digits;
}

function formatPhone(phone: string): string {
  // +972XXXXXXXXX → +972-XX-XXX-XXXX
  if (phone.startsWith("+972")) {
    const d = phone.slice(4);
    if (d.length === 9) {
      return `+972-${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    }
  }
  // +63XXXXXXXXXX → +63-XXX-XXX-XXXX
  if (phone.startsWith("+63")) {
    const d = phone.slice(3);
    if (d.length === 10) {
      return `+63-${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    }
  }
  return phone;
}

/* ── Component ── */

interface BlockedNumbersModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export default function BlockedNumbersModal({
  open,
  onClose,
  userId,
}: BlockedNumbersModalProps) {
  const { t } = useTranslation("dashboard");
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Fetch blocked numbers
  const { data: blockedNumbers = [] } = useQuery({
    queryKey: ["blocked_numbers", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("blocked_numbers")
        .eq("id", userId)
        .single();
      const raw = data?.blocked_numbers;
      return Array.isArray(raw) ? (raw as string[]) : [];
    },
    enabled: open,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["blocked_numbers", userId] });

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  // Add mutation
  const addMutation = useMutation({
    mutationFn: async (phone: string) => {
      const updated = [...blockedNumbers, phone];
      const { error } = await supabase
        .from("profiles")
        .update({ blocked_numbers: updated })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setInput("");
      setError(null);
      showFeedback(t("blockedNumbersAdded"));
    },
    onError: () => setError(t("blockedNumbersError")),
  });

  // Remove mutation
  const removeMutation = useMutation({
    mutationFn: async (phone: string) => {
      const updated = blockedNumbers.filter((n) => n !== phone);
      const { error } = await supabase
        .from("profiles")
        .update({ blocked_numbers: updated })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      showFeedback(t("blockedNumbersRemoved"));
    },
    onError: () => setError(t("blockedNumbersError")),
  });

  const handleAdd = () => {
    setError(null);
    const normalized = normalizePhone(input.trim());
    if (!normalized) {
      setError(t("blockedNumbersInvalid"));
      return;
    }
    if (blockedNumbers.includes(normalized)) {
      setError(t("blockedNumbersDuplicate"));
      return;
    }
    addMutation.mutate(normalized);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div>
              <h3 className="text-lg font-bold text-[#2D2A26]">
                {t("blockedNumbersTitle")}
              </h3>
              <p className="text-xs text-[#A39B90] mt-0.5">
                {t("blockedNumbersDesc")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#FAF7F3] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-[#7A7267]" />
            </button>
          </div>

          {/* Add input */}
          <div className="px-6 pb-3">
            <div className="flex gap-2">
              <input
                dir="ltr"
                type="tel"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder={t("blockedNumbersPlaceholder")}
                className="flex-1 border border-[#EDE6DD] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#C5BDB3] focus:outline-none focus:border-[#FF7E47] focus:ring-1 focus:ring-[#FF7E47]/20 transition-colors"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!input.trim() || addMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF7E47] hover:bg-[#E86B38] disabled:opacity-50 text-white text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                {t("blockedNumbersAdd")}
              </button>
            </div>
            {/* Error / Feedback */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-red-500 mt-1.5 px-1"
                >
                  {error}
                </motion.p>
              )}
              {feedback && !error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-emerald-600 mt-1.5 px-1"
                >
                  {feedback}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* List */}
          <div className="px-6 pb-5 max-h-72 overflow-y-auto">
            {blockedNumbers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-[#FAF7F3] flex items-center justify-center mb-3">
                  <ShieldOff className="w-6 h-6 text-[#C5BDB3]" />
                </div>
                <p className="text-sm font-medium text-[#7A7267]">
                  {t("blockedNumbersEmpty")}
                </p>
                <p className="text-xs text-[#A39B90] mt-1">
                  {t("blockedNumbersEmptyDesc")}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {blockedNumbers.map((phone) => (
                  <div
                    key={phone}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-[#FAF7F3] transition-colors group"
                  >
                    <span
                      dir="ltr"
                      className="text-sm text-[#2D2A26] font-mono"
                    >
                      {formatPhone(phone)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(phone)}
                      disabled={removeMutation.isPending}
                      className="p-1.5 rounded-lg text-[#C5BDB3] hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      title={t("blockedNumbersRemove")}
                      aria-label={t("blockedNumbersRemove")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
