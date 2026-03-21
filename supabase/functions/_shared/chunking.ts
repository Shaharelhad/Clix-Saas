/**
 * Chunk text into ~400-500 token segments with 50-token overlap.
 * Token estimate: text.length / 4 (reasonable for Hebrew).
 */
export function chunkText(
  text: string,
  targetTokens = 450,
  overlapTokens = 50,
): { content: string; chunk_index: number; token_count: number }[] {
  const charTarget = targetTokens * 4;
  const charOverlap = overlapTokens * 4;

  // Split by paragraph boundaries
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: { content: string; chunk_index: number; token_count: number }[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    // If adding this paragraph keeps us under target, merge
    if (currentChunk.length + para.length + 2 <= charTarget) {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
      continue;
    }

    // If current chunk has content, finalize it
    if (currentChunk) {
      chunks.push({
        content: currentChunk,
        chunk_index: chunkIndex++,
        token_count: Math.ceil(currentChunk.length / 4),
      });

      // Overlap: take the last overlapChars of current chunk
      const overlap = currentChunk.slice(-charOverlap);
      currentChunk = overlap + "\n\n" + para;
    } else {
      currentChunk = para;
    }

    // If the paragraph itself is very large, split at sentence boundaries
    while (currentChunk.length > charTarget * 1.3) {
      // Find a sentence break near the target
      const searchEnd = charTarget;
      let splitPos = -1;

      // Try splitting at Hebrew/English sentence endings
      for (let i = searchEnd; i > charTarget * 0.5; i--) {
        if (
          currentChunk[i] === "." ||
          currentChunk[i] === "?" ||
          currentChunk[i] === "!" ||
          currentChunk[i] === "\n"
        ) {
          splitPos = i + 1;
          break;
        }
      }

      if (splitPos === -1) splitPos = charTarget;

      const piece = currentChunk.slice(0, splitPos).trim();
      if (piece) {
        chunks.push({
          content: piece,
          chunk_index: chunkIndex++,
          token_count: Math.ceil(piece.length / 4),
        });
      }

      // Keep overlap + remainder
      const remainder = currentChunk.slice(splitPos).trim();
      const overlap = piece.slice(-charOverlap);
      currentChunk = overlap + (remainder ? "\n\n" + remainder : "");
    }
  }

  // Final chunk
  if (currentChunk.trim()) {
    const finalContent = currentChunk.trim();
    chunks.push({
      content: finalContent,
      chunk_index: chunkIndex,
      token_count: Math.ceil(finalContent.length / 4),
    });
  }

  return chunks;
}
