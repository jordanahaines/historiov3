import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  // mupdf (the Scribe PDF parser's engine) ships WASM and must load from
  // node_modules at runtime rather than being bundled.
  serverExternalPackages: ["mupdf", "historio-kindle-scribe-notes-parser"],
};

export default withWorkflow(nextConfig);
