/**
 * Shared Embedding Module — OpenRouter text-embedding-ada-002 (1536 dimensions).
 * Used by: rag-upload, llm-engine (RAG context injection)
 */

const OPENROUTER_EMBED_URL = "https://openrouter.ai/api/v1/embeddings";
const EMBED_MODEL = "openai/text-embedding-ada-002";
const EMBED_DIMENSIONS = 1536;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

/** Last embedding error message (for diagnostics) */
export let lastEmbedError: string | null = null;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Embed a single text string via OpenRouter.
 * Returns a 1536-dimension float array, or null on failure.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    lastEmbedError = "OPENROUTER_API_KEY not set";
    return null;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) await sleep(RETRY_DELAY_MS * attempt);

      const res = await fetch(OPENROUTER_EMBED_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBED_MODEL,
          input: text,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        lastEmbedError = `Embedding failed (${res.status}): ${errBody}`;
        console.error(`[embedText] attempt ${attempt + 1}: ${lastEmbedError}`);
        if (res.status >= 400 && res.status < 500 && res.status !== 429) break; // Don't retry client errors (except rate limit)
        continue;
      }

      const data = await res.json();
      const values = data?.data?.[0]?.embedding;
      if (!Array.isArray(values) || values.length !== EMBED_DIMENSIONS) {
        lastEmbedError = `Unexpected embedding response shape`;
        break;
      }

      lastEmbedError = null;
      return values as number[];
    } catch (err) {
      lastEmbedError = `Embedding network error: ${(err as Error).message}`;
      console.error(`[embedText] attempt ${attempt + 1}: ${lastEmbedError}`);
    }
  }

  return null;
}

/**
 * Embed multiple texts in sequential batches with retry logic.
 * Returns an array of embeddings (or null for failed items).
 */
export async function embedTexts(
  texts: string[],
  batchSize = 20,
): Promise<(number[] | null)[]> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    lastEmbedError = "OPENROUTER_API_KEY not set";
    return texts.map(() => null);
  }

  const results: (number[] | null)[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    let batchSuccess = false;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) await sleep(RETRY_DELAY_MS * attempt);

        const res = await fetch(OPENROUTER_EMBED_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: EMBED_MODEL,
            input: batch,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          lastEmbedError = `Embedding batch failed (${res.status}): ${errBody}`;
          console.error(`[embedTexts] batch ${i / batchSize}, attempt ${attempt + 1}: ${lastEmbedError}`);
          if (res.status >= 400 && res.status < 500 && res.status !== 429) break; // Don't retry client errors (except rate limit)
          continue;
        }

        const data = await res.json();
        const embeddings = data?.data as { embedding: number[]; index: number }[];

        if (!Array.isArray(embeddings)) {
          lastEmbedError = `Unexpected embedding batch response shape`;
          break;
        }

        // Sort by index to maintain order
        embeddings.sort((a, b) => a.index - b.index);

        for (let j = 0; j < batch.length; j++) {
          const emb = embeddings.find((e) => e.index === j);
          results.push(emb?.embedding ?? null);
        }

        batchSuccess = true;
        lastEmbedError = null;
        break;
      } catch (err) {
        lastEmbedError = `Embedding network error: ${(err as Error).message}`;
        console.error(`[embedTexts] batch ${i / batchSize}, attempt ${attempt + 1}: ${lastEmbedError}`);
      }
    }

    if (!batchSuccess) {
      results.push(...batch.map(() => null));
    }
  }

  return results;
}
