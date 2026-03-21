import { useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";
import { useAuthStore } from "@/store/auth.store";
import i18n from "@/i18n";

export function useAuth() {
  const { user, session, isLoading, setUser, setSession, setLoading, clear } = useAuthStore();

  const fetchProfile = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_profile");
    if (error || !data || data.length === 0) {
      setUser(null);
      return;
    }
    const profile = data[0];

    // Fetch bot_status from profiles table (not included in get_my_profile RPC)
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("bot_status")
      .eq("id", profile.id)
      .single();

    setUser({ ...profile, bot_status: profileRow?.bot_status });

    // Sync profile language to i18next
    if (profile.language && profile.language !== i18n.language) {
      i18n.changeLanguage(profile.language);
    }
  }, [setUser]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) {
        fetchProfile();
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      if (event === "SIGNED_IN") {
        // Only clear wizard data when switching to a different account
        const prevUserId = sessionStorage.getItem("createBot_userId");
        const newUserId = newSession?.user?.id;
        if (prevUserId && newUserId && prevUserId !== newUserId) {
          ["createBot_phase", "createBot_wizardStep", "createBot_formValues",
           "createBot_otherValues", "createBot_urlEntries", "createBot_qaEntries",
           "createBot_rulesEntries"].forEach((k) => sessionStorage.removeItem(k));
        }
        if (newUserId) {
          sessionStorage.setItem("createBot_userId", newUserId);
        }
        fetchProfile();
      } else if (event === "TOKEN_REFRESHED") {
        fetchProfile();
      } else if (event === "SIGNED_OUT") {
        clear();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, setSession, setLoading, clear]);

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
      },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      clear();
      // Clear CreateBot wizard session data so it doesn't leak to another account
      const keysToRemove = [
        "createBot_phase",
        "createBot_wizardStep",
        "createBot_formValues",
        "createBot_otherValues",
        "createBot_urlEntries",
        "createBot_qaEntries",
        "createBot_rulesEntries",
        "createBot_userId",
      ];
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    }
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    return { data, error };
  };

  const updateProfile = async (fields: { full_name?: string; phone?: string; language?: string }) => {
    if (!session?.user?.id) return { error: { message: "Not authenticated" } };
    const { error } = await supabase
      .from("profiles")
      .update(fields)
      .eq("id", session.user.id);
    if (!error) await fetchProfile();
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    return { data, error };
  };

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!session,
    isAdmin: user?.role === "admin",
    isPending: user?.status === "pending",
    isApproved: user?.status === "approved",
    hasCompletedOnboarding: !!user?.bot_status && user.bot_status !== "not_created",
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    updatePassword,
    refreshProfile: fetchProfile,
  };
}
