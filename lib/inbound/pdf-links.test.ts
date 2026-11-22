import { describe, expect, it } from "vitest";

import { pdfLinksOf } from "./pdf-links";

const s3 =
  "https://kindle-content-requests-prod.s3.amazonaws.com/abc/Notebook%20-%201776.pdf?X-Amz-Expires=604800&X-Amz-Signature=ff";

describe("pdfLinksOf", () => {
  it("unwraps the amazon.com redirect and decodes entities", () => {
    const wrapped = `https://www.amazon.com/gp/f.html?C=1&amp;M=x&amp;U=${encodeURIComponent(s3)}&amp;H=Z`;
    expect(
      pdfLinksOf({ html: `<a href="${wrapped}">Download PDF</a>` }),
    ).toEqual([s3]);
  });

  it("finds direct links in text and dedupes", () => {
    expect(pdfLinksOf({ html: `<a href="${s3}">x</a>`, text: s3 })).toEqual([
      s3,
    ]);
  });

  it("ignores other hosts, http, and non-PDF links", () => {
    expect(
      pdfLinksOf({
        html: `<a href="https://evil.example/a.pdf">x</a>
               <a href="http://x.s3.amazonaws.com/a.pdf">x</a>
               <a href="https://www.amazon.com/devicesupport">x</a>`,
      }),
    ).toEqual([]);
  });

  it("returns nothing for an empty body", () => {
    expect(pdfLinksOf({ html: null, text: null })).toEqual([]);
  });
});
