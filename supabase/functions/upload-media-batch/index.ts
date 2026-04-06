import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, media_urls } = await req.json();

    if (!user_id || !media_urls || !Array.isArray(media_urls) || media_urls.length === 0) {
      return new Response(
        JSON.stringify({ results: [], uploaded: 0, total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results: Array<{
      original_url: string;
      stored_url: string;
      success: boolean;
      error?: string;
    }> = [];

    const items = media_urls.slice(0, 20);

    for (const item of items) {
      const url = typeof item === "string" ? item : item.url;
      const mediaType = typeof item === "string" ? "image" : (item.type || "image");

      if (!url || !url.startsWith("http")) {
        results.push({ original_url: url || "", stored_url: "", success: false, error: "Invalid URL" });
        continue;
      }

      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 CLIX Bot Builder" },
          redirect: "follow",
        });

        if (!res.ok) {
          results.push({ original_url: url, stored_url: "", success: false, error: `HTTP ${res.status}` });
          continue;
        }

        const contentType = res.headers.get("content-type") || "application/octet-stream";
        const arrayBuffer = await res.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        // Size limits: 5MB for images, 20MB for videos
        const maxSize = mediaType === "video" ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
        if (uint8.length > maxSize) {
          results.push({ original_url: url, stored_url: "", success: false, error: "File too large" });
          continue;
        }

        // Skip tiny files (likely broken/tracking pixels)
        if (uint8.length < 200) {
          results.push({ original_url: url, stored_url: "", success: false, error: "File too small" });
          continue;
        }

        // Determine extension
        let ext = "bin";
        if (contentType.includes("png")) ext = "png";
        else if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
        else if (contentType.includes("gif")) ext = "gif";
        else if (contentType.includes("webp")) ext = "webp";
        else if (contentType.includes("svg")) ext = "svg";
        else if (contentType.includes("mp4")) ext = "mp4";
        else if (contentType.includes("webm")) ext = "webm";
        else if (contentType.includes("mov")) ext = "mov";
        else {
          const urlExt = url.split(".").pop()?.split("?")[0]?.toLowerCase();
          if (urlExt && ["png", "jpg", "jpeg", "gif", "webp", "svg", "mp4", "webm", "mov"].includes(urlExt)) {
            ext = urlExt === "jpeg" ? "jpg" : urlExt;
          }
        }

        const fileId = crypto.randomUUID();
        const storagePath = `${user_id}/${fileId}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("bot-media")
          .upload(storagePath, uint8, {
            contentType,
            upsert: false,
          });

        if (uploadErr) {
          results.push({ original_url: url, stored_url: "", success: false, error: uploadErr.message });
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from("bot-media")
          .getPublicUrl(storagePath);

        results.push({
          original_url: url,
          stored_url: publicUrlData.publicUrl,
          success: true,
        });
      } catch (err) {
        results.push({
          original_url: url,
          stored_url: "",
          success: false,
          error: err instanceof Error ? err.message : "Download failed",
        });
      }
    }

    const uploaded = results.filter((r) => r.success).length;
    return new Response(
      JSON.stringify({ results, uploaded, total: items.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("upload-media-batch error:", err);
    return new Response(
      JSON.stringify({ results: [], uploaded: 0, total: 0, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
