/**
 * Finds notebook PDF download links in an email body. Kindle's "You sent a file
 * from your Kindle" email carries no attachment: the PDF sits behind a
 * pre-signed S3 URL, wrapped in an amazon.com click-tracking redirect.
 */

/** Hosts we will fetch from. The email body is untrusted, so never follow arbitrary URLs. */
const ALLOWED_HOST_SUFFIXES = [".amazonaws.com", ".amazon.com"];
const ALLOWED_HOSTS = ["amazon.com"];

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    ALLOWED_HOSTS.includes(host) ||
    ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10)),
    );
}

/** Amazon wraps links as `https://www.amazon.com/gp/f.html?...&U=<encoded target>`. */
function unwrapAmazonRedirect(url: URL): URL {
  if (url.pathname !== "/gp/f.html") return url;
  const target = url.searchParams.get("U");
  if (!target) return url;
  try {
    return new URL(target);
  } catch {
    return url;
  }
}

function looksLikePdf(url: URL): boolean {
  return decodeURIComponent(url.pathname).toLowerCase().endsWith(".pdf");
}

/**
 * Returns the distinct, direct PDF URLs linked from the email's HTML and text
 * bodies, restricted to allowed hosts over https.
 */
export function pdfLinksOf(body: {
  html?: string | null;
  text?: string | null;
}): string[] {
  const candidates: string[] = [];

  for (const match of (body.html ?? "").matchAll(
    /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
  )) {
    candidates.push(decodeHtmlEntities(match[1] ?? match[2] ?? ""));
  }
  for (const match of (body.text ?? "").matchAll(/https:\/\/[^\s<>"')]+/gi)) {
    candidates.push(match[0]);
  }

  const links = new Set<string>();
  for (const candidate of candidates) {
    let url: URL;
    try {
      url = unwrapAmazonRedirect(new URL(candidate));
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || !isAllowedHost(url.hostname)) continue;
    if (!looksLikePdf(url)) continue;
    links.add(url.toString());
  }
  return [...links];
}
