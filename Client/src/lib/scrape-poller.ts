import { callScrapeStatus } from "@/services/edge-functions";

interface ScrapeStatusResponse {
  status?: string;
  scraped_pages?: number;
  products_found?: number;
}

interface PollCallbacks {
  onProgress: (pages: number, products: number) => void;
}

/**
 * Polls the scrape status endpoint until the job completes, fails, or returns "none".
 * Resolves when polling is done.
 */
export async function pollScrapeStatus(
  userId: string,
  { onProgress }: PollCallbacks,
): Promise<void> {
  let done = false;
  while (!done) {
    await new Promise((r) => setTimeout(r, 4000));
    try {
      const statusResult = await callScrapeStatus({ user_id: userId });
      if (statusResult.error) {
        done = true;
        continue;
      }
      const status = statusResult.data as ScrapeStatusResponse | null;
      onProgress(status?.scraped_pages ?? 0, status?.products_found ?? 0);
      if (
        status?.status === "completed" ||
        status?.status === "failed" ||
        status?.status === "none"
      ) {
        done = true;
      }
    } catch {
      done = true;
    }
  }
}
