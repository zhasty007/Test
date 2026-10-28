import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDraft, findNames, tidy } from "../validate.js";
import { incidentKey, alreadySeen, markSeen } from "../state.js";
import { renderPost, postFilename } from "../post.js";
import { looksLikeAccident } from "../fetch.js";

const incident = {
  source_ids: [0], incident_date: "2026-10-27", town: "Middletown", county: "Middlesex County",
  road: "Route 9", accident_type: "Car crash", severity: "Serious injuries",
  vehicles: ["sedan", "pickup truck"], police_agency: "Connecticut State Police", facts: [],
};
const sources = [{ name: "Example News", url: "https://example.com/a" }];
const draft = {
  title: "Two Seriously Injured in Route 9 Crash in Middletown",
  description: "Two people were seriously injured in a two-vehicle crash on Route 9 in Middletown, police said.",
  slug: "middletown-route-9-crash",
  body_markdown: "A 42-year-old driver was seriously injured, according to police.\n\n## What to do after a serious crash in Connecticut\n\n- Get medical care.",
};

test("clean draft passes", () => {
  assert.deepEqual(validateDraft(draft, incident, sources), []);
});

test("names are caught", () => {
  assert.ok(findNames("The driver, John Smith, 34, was taken to the hospital.").length);
  assert.ok(findNames("Police identified as Maria Lopez the driver").length);
  assert.ok(findNames("Mr. Jones was hurt").length);
  assert.equal(findNames("Connecticut State Police said a 34-year-old driver from New Haven was hurt.").length, 0);
});

test("missing sources and banned phrases fail", () => {
  assert.ok(validateDraft(draft, incident, []).includes("no sources"));
  const bad = { ...draft, body_markdown: draft.body_markdown + " Call us for the best lawyer." };
  assert.ok(validateDraft(bad, incident, sources).some((p) => p.startsWith("banned phrase")));
});

test("dedupe by key and by source link", () => {
  const state = { incidents: {}, urls: {} };
  assert.equal(alreadySeen(state, incident, ["https://example.com/a"]), false);
  markSeen(state, incident, ["https://example.com/a"], "f.md");
  assert.equal(alreadySeen(state, { ...incident, road: "route 9" }, []), true);
  assert.equal(alreadySeen(state, { ...incident, town: "Cromwell" }, ["https://example.com/a"]), true);
  assert.equal(alreadySeen(state, { ...incident, town: "Cromwell" }, ["https://example.com/b"]), false);
  assert.equal(incidentKey(incident), "2026-10-27|middletown|route 9|car crash");
});

test("post rendering", () => {
  assert.equal(postFilename(incident, draft), "2026-10-27-middletown-route-9-crash.md");
  const md = renderPost(incident, { ...draft, title: "Crash — Route 9" }, sources);
  assert.match(md, /^---\ntitle: "Crash, Route 9"/);
  assert.match(md, /county: "Middlesex County"/);
  assert.match(md, /url: "https:\/\/example.com\/a"/);
});

test("keyword prefilter and tidy", () => {
  assert.ok(looksLikeAccident("Pedestrian struck on Main Street"));
  assert.ok(!looksLikeAccident("City council approves budget"));
  assert.equal(tidy("a — b"), "a, b");
});
