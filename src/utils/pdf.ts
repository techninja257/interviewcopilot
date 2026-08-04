/** Roughly how much text a page must yield before we assume it is real text. */
const MIN_CHARS_PER_PAGE = 30;

export class PdfExtractionError extends Error {}

/** Words that appear in resume headings, never in a person's name. */
const NOT_A_NAME =
  /\b(resume|curriculum|vitae|cv|profile|summary|objective|experience|education|skills|contact|engineer|developer|manager|director|analyst|designer|consultant|senior|junior|staff|principal|lead)\b/i;

/**
 * A bare city line sits where a name does and is shaped like one, so the
 * structural checks alone cannot tell them apart. Matching the common ones is
 * crude but cheap, and it only has to beat filling the field with a location.
 */
const LOOKS_LIKE_PLACE =
  /^(san|new|los|las|st\.?|fort|mount|north|south|east|west|port|lake)\s/i;

/**
 * Best-effort guess at the candidate's name from the top of a resume.
 *
 * Nearly every resume opens with the name on its own line, so the first line
 * that looks like a name is a good guess — but only a guess. It returns null
 * rather than something doubtful, because the name lands in the hiring record
 * and a confidently wrong one is worse than an empty field the user fills in.
 */
export function guessCandidateName(text: string): string | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 5)) {
    // Strip anything after a separator — "Alex Rivera · alex@example.com".
    const candidate = line.split(/[|·•—–]|\s{3,}/)[0].trim();

    if (candidate.length < 4 || candidate.length > 40) continue;
    if (NOT_A_NAME.test(candidate)) continue;
    if (LOOKS_LIKE_PLACE.test(candidate)) continue;
    if (/[@\d(),:/]|https?:/i.test(candidate)) continue; // emails, phones, URLs

    const words = candidate.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;

    // Every word should read as a name: Alex, O'Brien, Smith-Jones, de.
    const nameLike = words.every((w) => /^[\p{L}][\p{L}'’.-]*$/u.test(w));
    if (!nameLike) continue;

    // Reject ALL-CAPS headings, but keep genuinely capitalised names.
    const capitalised = words.filter((w) => /^\p{Lu}/u.test(w)).length;
    if (capitalised < Math.min(2, words.length)) continue;

    return candidate;
  }
  return null;
}

/**
 * pdf.js is ~430 kB and most sessions never upload a resume, so it is loaded
 * on first use rather than bundled into the initial chunk. The worker URL is
 * resolved by Vite (not a CDN), so extraction stays local and works offline.
 */
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

function loadPdfjs() {
  pdfjsPromise ??= (async () => {
    const [pdfjs, { default: workerUrl }] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  })();
  return pdfjsPromise;
}

/**
 * Pulls plain text out of a resume PDF, in the browser.
 *
 * The failure worth handling is a scanned resume: pdf.js parses it happily and
 * returns almost nothing, because the pages are images. Silently feeding an
 * empty string to the personalizer would produce questions grounded in nothing,
 * so that case is detected and reported rather than passed along.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await loadPdfjs();
  const buffer = await file.arrayBuffer();

  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  } catch (err) {
    const detail = err instanceof Error ? err.message : '';
    if (/password/i.test(detail)) {
      throw new PdfExtractionError(
        'That PDF is password-protected. Remove the password, or paste the text instead.',
      );
    }
    throw new PdfExtractionError(
      "That file could not be read as a PDF. If it's a Word document, export it as PDF or paste the text.",
    );
  }

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // Items carry positions, not line breaks. Insert a newline when the y
    // position moves, so bullet lists don't collapse into one run-on line —
    // the personalizer quotes resume lines verbatim, so line structure matters.
    let text = '';
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = item.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) text += '\n';
      else if (text && !text.endsWith(' ') && !text.endsWith('\n')) text += ' ';
      text += item.str;
      lastY = y;
    }
    pages.push(text.trim());
  }

  const full = pages.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

  if (full.length < MIN_CHARS_PER_PAGE * Math.min(doc.numPages, 2)) {
    throw new PdfExtractionError(
      'That PDF appears to be a scan, so there is no text to read. Paste the resume text instead.',
    );
  }

  return full;
}
