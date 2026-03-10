import { getDocument, GlobalWorkerOptions, version } from "pdfjs-dist";

// Set worker source to CDN (jsdelivr mirrors npm directly, unlike cdnjs which may lag behind)
GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

/**
 * Extract all text content from a PDF file in the browser.
 * Returns the full text with pages separated by double newlines.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    if (pageText) pages.push(pageText);
  }

  return pages.join("\n\n");
}
