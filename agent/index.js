// Daily Connecticut accident agent.
//   npm run agent              fetch, extract, draft, write posts + state
//   npm run agent -- --dry-run print what would be written, change nothing
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { FEEDS } from "./sources.js";
import { fetchCandidates } from "./fetch.js";
import { createClient, extractIncidents, draftPost } from "./claude.js";
import { validateDraft } from "./validate.js";
import { loadState, saveState, alreadySeen, markSeen } from "./state.js";
import { postFilename, renderPost } from "./post.js";

const dryRun = process.argv.includes("--dry-run");
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

async function main() {
  const now = new Date();
  const since = new Date(now.getTime() - config.lookbackHours * 36e5);
  console.log(`Accident agent: model=${config.model} since=${since.toISOString()}${dryRun ? " (dry run)" : ""}`);

  const items = await fetchCandidates(FEEDS, { since, max: config.maxCandidates });
  console.log(`${items.length} candidate news item(s) after keyword filter`);

  const report = { written: [], skipped: [] };
  if (items.length) {
    const client = createClient();
    const incidents = await extractIncidents(client, items);
    console.log(`${incidents.length} qualifying incident(s) extracted`);

    const state = loadState(config.statePath);
    for (const inc of incidents) {
      if (report.written.length >= config.maxPostsPerRun) break;

      const sources = [...new Set(inc.source_ids)]
        .map((i) => items[i])
        .filter(Boolean)
        .map((it) => ({ name: it.source, url: it.link }));
      const links = sources.map((s) => s.url);
      if (!isDate(inc.incident_date)) inc.incident_date = items[inc.source_ids[0]]?.published.slice(0, 10) ?? now.toISOString().slice(0, 10);
      const label = `${inc.town || "?"} / ${inc.road || "?"} / ${inc.incident_date}`;

      if (alreadySeen(state, inc, links)) {
        report.skipped.push({ label, reason: "already published" });
        continue;
      }

      let draft;
      try {
        draft = await draftPost(client, inc);
      } catch (err) {
        report.skipped.push({ label, reason: `draft failed: ${err.message}`, sources });
        continue;
      }

      const problems = validateDraft(draft, inc, sources);
      if (problems.length) {
        report.skipped.push({ label, reason: problems.join("; "), sources });
        continue;
      }

      const file = postFilename(inc, draft);
      const body = renderPost(inc, draft, sources);
      if (dryRun) {
        console.log(`\n----- ${file} -----\n${body}`);
      } else {
        fs.writeFileSync(path.join(config.postsDir, file), body);
        markSeen(state, inc, links, file, now);
      }
      report.written.push({ file, title: draft.title, severity: inc.severity, sources });
    }

    if (!dryRun) saveState(config.statePath, state, config.stateRetentionDays, now);
  }

  const md = renderReport(report, now);
  if (!dryRun) fs.writeFileSync(config.runReportPath, md);
  console.log(`\n${md}`);
}

function renderReport({ written, skipped }, now) {
  const lines = [`## Accident agent run ${now.toISOString().slice(0, 10)}`, ""];
  lines.push(`**${written.length} new post(s)** for review. Check every fact against the linked sources before merging. Merging publishes.`, "");
  for (const w of written) {
    lines.push(`- [ ] \`${w.file}\`: ${w.title} (${w.severity})`);
    for (const s of w.sources) lines.push(`  - ${s.name}: ${s.url}`);
  }
  if (skipped.length) {
    lines.push("", `<details><summary>${skipped.length} skipped</summary>`, "");
    for (const s of skipped) lines.push(`- ${s.label}: ${s.reason}`);
    lines.push("", "</details>");
  }
  return lines.join("\n") + "\n";
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
