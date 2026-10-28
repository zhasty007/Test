import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { config } from "./config.js";
import { ExtractResult, Draft } from "./schemas.js";

const prompt = (name) => fs.readFileSync(path.join(config.promptsDir, `${name}.md`), "utf8");

export function createClient() {
  return new Anthropic();
}

// One structured-output call. Server-side fallback is enabled so a safety
// classifier false positive on crash news reroutes instead of failing the run.
async function parse(client, { system, user, schema, effort }) {
  const response = await client.beta.messages.parse({
    model: config.model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error(`model declined (${response.stop_details?.category ?? "unknown"})`);
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error(`no parseable output (stop_reason=${response.stop_reason})`);
  }
  return response.parsed_output;
}

export async function extractIncidents(client, items) {
  const list = items
    .map((it, i) => `[${i}] ${it.published.slice(0, 10)} | ${it.source}\nHeadline: ${it.title}\nSnippet: ${it.snippet}`)
    .join("\n\n");
  const result = await parse(client, {
    system: prompt("extract"),
    user: `News items:\n\n${list}`,
    schema: ExtractResult,
    effort: "medium",
  });
  return result.incidents;
}

export async function draftPost(client, incident) {
  const facts = {
    incident_date: incident.incident_date,
    town: incident.town,
    county: incident.county,
    road: incident.road,
    accident_type: incident.accident_type,
    severity: incident.severity,
    vehicles: incident.vehicles,
    police_agency: incident.police_agency,
    facts: incident.facts,
  };
  return parse(client, {
    system: prompt("write"),
    user: `Incident facts (JSON):\n${JSON.stringify(facts, null, 2)}`,
    schema: Draft,
    effort: "medium",
  });
}
