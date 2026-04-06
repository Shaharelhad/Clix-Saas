import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "shahar@seai.co.il";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token || "");

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Double check: email + admin role
    if (user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    let result: any;

    switch (action) {
      case "list_users": {
        const { page = 1, limit = 25, search, status, tier, blocked } = body;
        const offset = (page - 1) * limit;

        let query = supabaseAdmin
          .from("profiles")
          .select("*", { count: "exact" });

        if (search) {
          query = query.ilike("email", `%${search}%`);
        }
        if (status) {
          query = query.eq("subscription_status", status);
        }
        if (tier) {
          query = query.eq("plan_tier", tier);
        }
        if (blocked !== undefined && blocked !== null && blocked !== "") {
          query = query.eq("is_blocked", blocked === true || blocked === "true");
        }

        query = query
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        const { data, count, error } = await query;
        if (error) throw error;

        result = { users: data, total: count, page, limit };
        break;
      }

      case "get_user_detail": {
        const { userId } = body;

        const [profileRes, adsRes, businessesRes, transactionsRes, historyRes] =
          await Promise.all([
            supabaseAdmin
              .from("profiles")
              .select("*")
              .eq("id", userId)
              .single(),
            supabaseAdmin
              .from("ads")
              .select("*")
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(20),
            supabaseAdmin
              .from("businesses")
              .select("*")
              .eq("user_id", userId)
              .order("created_at", { ascending: false }),
            supabaseAdmin
              .from("tokens_transactions")
              .select("*")
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(50),
            supabaseAdmin
              .from("subscription_history")
              .select("*")
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .limit(20),
          ]);

        if (profileRes.error) throw profileRes.error;

        // Get auth user data for metadata
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
          userId
        );

        result = {
          profile: profileRes.data,
          ads: adsRes.data || [],
          businesses: businessesRes.data || [],
          transactions: transactionsRes.data || [],
          subscriptionHistory: historyRes.data || [],
          authUser: authUser?.user
            ? {
                last_sign_in_at: authUser.user.last_sign_in_at,
                created_at: authUser.user.created_at,
                email_confirmed_at: authUser.user.email_confirmed_at,
                banned_until: authUser.user.banned_until,
              }
            : null,
        };
        break;
      }

      case "update_credits": {
        const { userId, amount } = body;

        // Use atomic function
        const { data: newBalance, error: creditError } =
          await supabaseAdmin.rpc("admin_add_credits", {
            user_id_param: userId,
            amount_param: amount,
          });

        if (creditError) throw creditError;

        // Log the transaction
        await supabaseAdmin.from("tokens_transactions").insert({
          user_id: userId,
          amount: amount,
          transaction_type: amount > 0 ? "admin_credit" : "admin_debit",
        });

        result = { newBalance };
        break;
      }

      case "block_user": {
        const { userId, blocked } = body;

        // Update profile
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({ is_blocked: blocked })
          .eq("id", userId);
        if (profileError) throw profileError;

        // Ban/unban via auth admin
        if (blocked) {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: "876000h", // ~100 years
          });
        } else {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            ban_duration: "none",
          });
        }

        result = { success: true, blocked };
        break;
      }

      case "reset_password": {
        const { email } = body;
        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "delete_user": {
        const { userId } = body;
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "freeze_user": {
        const { userId, frozen } = body;
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: frozen ? "expired" : "active",
          })
          .eq("id", userId);
        if (error) throw error;
        result = { success: true, frozen };
        break;
      }

      case "list_ads": {
        const { page = 1, limit = 25, search } = body;
        const offset = (page - 1) * limit;

        let query = supabaseAdmin
          .from("ads")
          .select("*, profiles!inner(email)", { count: "exact" });

        if (search) {
          query = query.ilike("business_name", `%${search}%`);
        }

        query = query
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        const { data, count, error } = await query;
        if (error) throw error;
        result = { ads: data, total: count, page, limit };
        break;
      }

      case "list_businesses": {
        const { page = 1, limit = 25, search } = body;
        const offset = (page - 1) * limit;

        let query = supabaseAdmin
          .from("businesses")
          .select("*, profiles!inner(email)", { count: "exact" });

        if (search) {
          query = query.ilike("business_name", `%${search}%`);
        }

        query = query
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        const { data, count, error } = await query;
        if (error) throw error;
        result = { businesses: data, total: count, page, limit };
        break;
      }

      case "get_analytics": {
        const { days = 30 } = body;
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);
        const since = sinceDate.toISOString().split("T")[0];

        const [
          totalUsersRes,
          totalAdsRes,
          totalBusinessesRes,
          activeSubsRes,
          dailySignupsRes,
          dailyAdsRes,
          dailyPageViewsRes,
          recentSubsRes,
        ] = await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("*", { count: "exact", head: true }),
          supabaseAdmin
            .from("ads")
            .select("*", { count: "exact", head: true }),
          supabaseAdmin
            .from("businesses")
            .select("*", { count: "exact", head: true }),
          supabaseAdmin
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("subscription_status", "active"),
          supabaseAdmin.rpc("admin_daily_signups", { since_date: since }),
          supabaseAdmin.rpc("admin_daily_ads", { since_date: since }),
          supabaseAdmin.rpc("admin_daily_page_views", { since_date: since }),
          supabaseAdmin
            .from("subscription_history")
            .select("*, profiles!inner(email)")
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        result = {
          totals: {
            users: totalUsersRes.count || 0,
            ads: totalAdsRes.count || 0,
            businesses: totalBusinessesRes.count || 0,
            activeSubscriptions: activeSubsRes.count || 0,
          },
          dailySignups: dailySignupsRes.data || [],
          dailyAds: dailyAdsRes.data || [],
          dailyPageViews: dailyPageViewsRes.data || [],
          recentSubscriptions: recentSubsRes.data || [],
        };
        break;
      }

      case "toggle_featured_ad": {
        const { adId, featured } = body;
        const { error } = await supabaseAdmin
          .from("ads")
          .update({ is_featured: featured })
          .eq("id", adId);
        if (error) throw error;
        result = { success: true, featured };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin API error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
