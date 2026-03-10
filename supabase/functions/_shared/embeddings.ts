/**
 * Shared Embedding Module — OpenRouter text-embedding-ada-002 (1536 dimensions).
 * Used by: rag-upload, llm-engine (RAG context injection)
 */

const OPENROUTER_EMBED_URL = "https://openrouter.ai/api/v1/embeddings";
const EMBED_MODEL = "openai/text-embedding-ada-002";
const EMBED_DIMENSIONS = 1536;

/**
 * Embed a single text string via OpenRouter.
 * Returns a 1536-dimension float array, or null on failure.
 */
export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return null;

  try {
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

    if (!res.ok) return null;

    const data = await res.json();
    const values = data?.data?.[0]?.embedding;
    if (!Array.isArray(values) || values.length !== EMBED_DIMENSIONS) return null;

    return values as number[];
  } catch {
    return null;
  }
}

/**
 * Embed multiple texts in sequential batches.
 * Returns an array of embeddings (or null for failed items).
 */
export async function embedTexts(
  texts: string[],
  batchSize = 20,
): Promise<(number[] | null)[]> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return texts.map(() => null);

  const results: (number[] | null)[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    try {
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
        console.error(`Embedding batch failed (${res.status}): ${errBody}`);
        results.push(...batch.map(() => null));
        continue;
      }

      const data = await res.json();
      const embeddings = data?.data as { embedding: number[]; index: number }[];

      if (!Array.isArray(embeddings)) {
        results.push(...batch.map(() => null));
        continue;
      }

      // Sort by index to maintain order
      embeddings.sort((a, b) => a.index - b.index);

      for (let j = 0; j < batch.length; j++) {
        const emb = embeddings.find((e) => e.index === j);
        results.push(emb?.embedding ?? null);
      }
    } catch {
      results.push(...batch.map(() => null));
    }
  }

  return results;
}
