import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body = await req.json();
    const user_id = await getAuthenticatedUserId(req);
    const { scrape_job_id } = body;

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
          { headers: { ...cors, "Content-Type": "application/json" } },
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
        { headers: { ...cors, "Content-Type": "application/json" } },
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
        { headers: { ...cors, "Content-Type": "application/json" } },
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
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("scrape-status error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
