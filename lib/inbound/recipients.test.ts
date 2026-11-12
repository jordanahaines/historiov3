import { describe, expect, it } from "vitest";

import { extractInboundTokens } from "./recipients";

const DOMAIN = "ioestiogra.resend.app";

describe("extractInboundTokens", () => {
  it("extracts the local part of an address on the inbound domain", () => {
    expect(extractInboundTokens([`abc123@${DOMAIN}`], DOMAIN)).toEqual([
      "abc123",
    ]);
  });

  it("is case-insensitive on both parts", () => {
    expect(
      extractInboundTokens([`AbC123@IOESTIOGRA.resend.APP`], DOMAIN),
    ).toEqual(["abc123"]);
  });

  it("handles display-name form", () => {
    expect(
      extractInboundTokens([`Jordan Haines <abc123@${DOMAIN}>`], DOMAIN),
    ).toEqual(["abc123"]);
  });

  it("collects tokens from several recipients and ignores other domains", () => {
    expect(
      extractInboundTokens(
        [`a@${DOMAIN}`, "b@example.com", `c@${DOMAIN}`, `a@${DOMAIN}`],
        DOMAIN,
      ),
    ).toEqual(["a", "c"]);
  });

  it("does not match a subdomain or a lookalike domain", () => {
    expect(
      extractInboundTokens(
        [`a@x.${DOMAIN}`, `a@${DOMAIN}.evil.com`, `a@not${DOMAIN}`],
        DOMAIN,
      ),
    ).toEqual([]);
  });

  it("ignores malformed addresses", () => {
    expect(
      extractInboundTokens(["", "no-at-sign", `@${DOMAIN}`], DOMAIN),
    ).toEqual([]);
  });
});
