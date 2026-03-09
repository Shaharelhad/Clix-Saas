import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, scrape_job_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (scrape_job_id) {
      // Single job query (backwards compat)
      const { data: job, error: jobErr } = await supabase
        .from("scrape_jobs")
        .select("id, base_url, status, total_pages, scraped_pages, created_at, updated_at")
        .eq("id", scrape_job_id)
        .eq("user_id", user_id)
        .single();

      if (jobErr || !job) {
        return new Response(
          JSON.stringify({ status: "none", message: "No scrape job found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { count: productCount } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("scrape_job_id", job.id);

      return new Response(
        JSON.stringify({
          scrape_job_id: job.id,
          base_url: job.base_url,
          status: job.status,
          total_pages: job.total_pages,
          scraped_pages: job.scraped_pages,
          products_found: productCount || 0,
          created_at: job.created_at,
          updated_at: job.updated_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Multi-job aggregate: get ALL recent jobs for this user (last 15 minutes)
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: jobs, error: jobsErr } = await supabase
      .from("scrape_jobs")
      .select("id, base_url, status, total_pages, scraped_pages")
      .eq("user_id", user_id)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });

    if (jobsErr || !jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ status: "none", message: "No scrape jobs found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Aggregate status: "completed" only when ALL jobs are done
    const allDone = jobs.every((j) => j.status === "completed" || j.status === "failed");
    const anyFailed = jobs.some((j) => j.status === "failed");
    const aggregateStatus = allDone
      ? (anyFailed && jobs.every((j) => j.status === "failed") ? "failed" : "completed")
      : "scraping";

    const totalPages = jobs.reduce((sum, j) => sum + (j.total_pages || 0), 0);
    const scrapedPages = jobs.reduce((sum, j) => sum + (j.scraped_pages || 0), 0);

    // Count products across all jobs
    const jobIds = jobs.map((j) => j.id);
    const { count: productCount } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .in("scrape_job_id", jobIds);

    return new Response(
      JSON.stringify({
        status: aggregateStatus,
        total_pages: totalPages,
        scraped_pages: scrapedPages,
        products_found: productCount || 0,
        jobs_total: jobs.length,
        jobs_completed: jobs.filter((j) => j.status === "completed" || j.status === "failed").length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("scrape-status error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
