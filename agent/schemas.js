import { z } from "zod";

export const COUNTIES = [
  "Fairfield County", "Hartford County", "Litchfield County", "Middlesex County",
  "New Haven County", "New London County", "Tolland County", "Windham County", "Unknown",
];

export const ACCIDENT_TYPES = [
  "Car crash", "Truck crash", "Motorcycle crash", "Pedestrian accident", "Bicycle accident",
  "Wrong-way crash", "Hit-and-run", "Bus crash", "Other",
];

export const Incident = z.object({
  source_ids: z.array(z.number().int()),
  incident_date: z.string(),
  town: z.string(),
  county: z.enum(COUNTIES),
  road: z.string(),
  accident_type: z.enum(ACCIDENT_TYPES),
  severity: z.enum(["Fatal", "Serious injuries", "Injuries reported"]),
  vehicles: z.array(z.string()),
  police_agency: z.string(),
  facts: z.array(z.string()),
});

export const ExtractResult = z.object({ incidents: z.array(Incident) });

export const Draft = z.object({
  title: z.string(),
  description: z.string(),
  slug: z.string(),
  body_markdown: z.string(),
});
