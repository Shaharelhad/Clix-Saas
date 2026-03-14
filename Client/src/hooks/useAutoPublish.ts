import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";

interface PublishResult {
  success: boolean;
  message: string;
}

export function useAutoPublish() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const autoPublish = async (): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const { data, error } = await supabase.rpc("publish_bot_changes", {
        p_user_id: user.id,
      });
      if (error) throw error;
      const result = data as unknown as PublishResult;
      if (!result.success) return false;
      queryClient.invalidateQueries({ queryKey: ["form_response"] });
      return true;
    } catch {
      return false;
    }
  };

  return { autoPublish };
}
