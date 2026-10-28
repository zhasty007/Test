import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
  lookbackHours: Number(process.env.LOOKBACK_HOURS || 36),
  maxPostsPerRun: Number(process.env.MAX_POSTS_PER_RUN || 8),
  maxCandidates: 80,
  postsDir: path.join(root, "src/posts/accidents"),
  statePath: path.join(root, "agent/state/seen.json"),
  runReportPath: path.join(root, "agent/state/last-run.md"),
  promptsDir: path.join(root, "agent/prompts"),
  // Forget incidents after this many days so state stays small.
  stateRetentionDays: 60,
};
