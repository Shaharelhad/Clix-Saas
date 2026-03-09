import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";

export function useDraftStatus() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["draft-status", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("form_responses")
        .select("bot_prompt, draft_bot_prompt, draft_faq_entries")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!data) return { hasDraft: false };

      const hasPromptDraft =
        data.draft_bot_prompt != null && data.draft_bot_prompt !== data.bot_prompt;
      const hasFaqDraft = data.draft_faq_entries != null;

      return { hasDraft: hasPromptDraft || hasFaqDraft };
    },
  });

  return {
    hasDraft: query.data?.hasDraft ?? false,
    isLoading: query.isLoading,
  };
}
