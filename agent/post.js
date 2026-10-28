import { tidy } from "./validate.js";

const yamlStr = (s) => JSON.stringify(String(s ?? ""));

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-$/, "");
}

export function postFilename(incident, draft) {
  return `${incident.incident_date}-${slugify(draft.slug || `${incident.town} ${incident.accident_type}`)}.md`;
}

export function renderPost(incident, draft, sources) {
  const fm = [
    "---",
    `title: ${yamlStr(tidy(draft.title))}`,
    `description: ${yamlStr(tidy(draft.description))}`,
    `date: ${incident.incident_date}`,
    `town: ${yamlStr(incident.town)}`,
    `county: ${yamlStr(incident.county)}`,
    `road: ${yamlStr(incident.road)}`,
    `accident_type: ${yamlStr(incident.accident_type)}`,
    `severity: ${yamlStr(incident.severity)}`,
    "sources:",
    ...sources.map((s) => `  - name: ${yamlStr(s.name)}\n    url: ${yamlStr(s.url)}`),
    "---",
  ];
  return `${fm.join("\n")}\n\n${tidy(draft.body_markdown).trim()}\n`;
}
