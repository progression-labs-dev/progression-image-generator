import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to web/ — the parent pl-imagery-lab dir has its own
  // bun.lock (the CLI batch tool), which Turbopack would otherwise infer as root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
