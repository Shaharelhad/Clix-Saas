import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";

export function usePublishDraft() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["draft-status"] });
    queryClient.invalidateQueries({ queryKey: ["bot-draft-status"] });
    queryClient.invalidateQueries({ queryKey: ["form_response"] });
  };

  const publish = async () => {
    if (!user?.id || isPublishing) return;
    setIsPublishing(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc("publish_bot_changes", {
        p_user_id: user.id,
      });
      if (error) throw error;
      const result = data as unknown as { success: boolean; message: string };
      if (result.success) {
        setFeedback({ type: "success", message: "publishSuccess" });
        invalidateAll();
      } else {
        setFeedback({ type: "error", message: result.message });
      }
    } catch {
      setFeedback({ type: "error", message: "publishError" });
    } finally {
      setIsPublishing(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const discard = async () => {
    if (!user?.id || isDiscarding) return;
    setIsDiscarding(true);
    setFeedback(null);
    try {
      const { error } = await supabase.rpc("discard_bot_draft", {
        p_user_id: user.id,
      });
      if (error) throw error;
      setFeedback({ type: "success", message: "discardSuccess" });
      invalidateAll();
    } catch {
      setFeedback({ type: "error", message: "discardError" });
    } finally {
      setIsDiscarding(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return { publish, discard, isPublishing, isDiscarding, feedback };
}
