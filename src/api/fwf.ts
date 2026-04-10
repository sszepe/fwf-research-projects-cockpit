/// <reference types="vite/client" />

import { personSlug } from "../router";

const API_BASE = import.meta.env.VITE_FWF_API_BASE || "https://openapi.fwf.ac.at";
const API_KEY = import.meta.env.VITE_FWF_API_KEY || "";
export const ORG_ROR = import.meta.env.VITE_ORG_ROR || "https://ror.org/xxx";
export const ORG_NAME = import.meta.env.VITE_ORG_NAME || "xxx";

function authHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

export const OUTPUT_CATEGORIES = [
  { key: "publications", label: "Publications" },
  { key: "creative and artistic works", label: "Creative & Artistic Works" },
  { key: "awards", label: "Awards" },
  { key: "medical products and interventions", label: "Medical Products" },
  { key: "patents and licenses", label: "Patents & Licenses" },
  { key: "research data and analysis techniques", label: "Research Data" },
  { key: "research tools and methods", label: "Tools & Methods" },
  { key: "science communication", label: "Science Communication" },
  { key: "societal impact", label: "Societal Impact" },
  { key: "software and technical products", label: "Software & Tech" },
  { key: "start-ups", label: "Start-ups" },
] as const;

export type OutputCategoryKey = typeof OUTPUT_CATEGORIES[number]["key"] | "all";

export interface FWFProject {
  id: string;
  "_str.projecttitle.en"?: string;
  "_str.projecttitle.de"?: string;
  "_str.principalinvestigator.firstname"?: string;
  "_str.principalinvestigator.lastname"?: string;
  "_str.principalinvestigator.researchinstitute.name"?: string;
  "_str.principalinvestigator.researchinstitute.ror"?: string;
  "_str.principalinvestigator.orcid"?: string;
  "_str.principalinvestigator.orcidlink"?: string;
  "_str.principalinvestigator.webpage"?: string;
  "_str.status.en"?: string;
  "_str.status.de"?: string;
  "_str.program.en"?: string;
  "_str.program.de"?: string;
  "_str.call.en"?: string;
  "_str.grantdoi"?: string;
  "_str.url"?: string;
  "_str.prproposalsummary.en"?: string;
  "_str.prproposalsummary.de"?: string;
  "_str.prfinalreport.en"?: string;
  "_long.approvedamount"?: number;
  "_date.startdate"?: string;
  "_date.enddate"?: string;
  "_date.approvaldate"?: string;
  "_list.keywords.split"?: string[];
  "_list.researchdisciplines.en"?: string[];
  "_list.researchfields.en"?: string[];
  "_list.keyresearchers"?: Array<{ name?: string; institution?: string; ror?: string }>;
  "_list.researchinstitutes"?: Array<{ name?: string; ror?: string; percentage?: number }>;
  "_list.connected.output"?: string[];
  "_list.connected.further-funding"?: string[];
}

export interface FWFOutput {
  id: string;
  "_str.category"?: string;
  "_str.title"?: string;
  "_str.doi"?: string;
  "_str.year"?: string;
  "_str.authors"?: string;
  "_str.journal"?: string;
  "_str.isbn"?: string;
  "_str.pmid"?: string;
  "_str.publisher"?: string;
  "_str.url"?: string;
  "_str.type"?: string;
  "_str.linkout"?: string;
  "_list.connected.projects"?: string[];
  [key: string]: unknown;
}

export interface FWFFurtherFunding {
  id: string;
  "_str.title"?: string;
  "_str.funder"?: string;
  "_str.funderabbreviation"?: string;
  "_str.programname"?: string;
  "_str.grantnumber"?: string;
  "_str.grantdoi"?: string;
  "_str.url"?: string;
  "_str.status"?: string;
  "_long.approvedamount"?: number;
  "_str.currency"?: string;
  "_date.startdate"?: string;
  "_date.enddate"?: string;
  "_list.connected.projects"?: string[];
  [key: string]: unknown;
}

export interface PersonRecord {
  id: string;
  slug: string;
  name: string;
  institution: string;
  orcid?: string;
  orcidLink?: string;
  webpage?: string;
  isPI: boolean;
  roles: string[];
  projectIds: string[];
  outputIds: string[];
}

let projectsCache: Promise<FWFProject[]> | null = null;
let outputsCache: Promise<FWFOutput[]> | null = null;
let personsCache: Promise<PersonRecord[]> | null = null;

function uniqById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function normalizeCategory(value?: string): string {
  return (value || "").trim().toLowerCase();
}

function normalizeProjectToken(value: string): string {
  return value.replace(/^project[.-]/i, "");
}

async function postSearch<T>(index: "projects" | "output" | "further-funding", body: Record<string, unknown>): Promise<T[]> {
  const res = await fetch(`${API_BASE}/indexes/${index}/search`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FWF API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.hits || [];
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (true) {
      const current = next;
      next += 1;
      if (current >= items.length) break;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () => run());
  await Promise.all(workers);
  return results;
}

export function projectTitle(p: FWFProject): string {
  return p["_str.projecttitle.en"] || p["_str.projecttitle.de"] || p.id || "Untitled";
}

export function outputTitle(o: FWFOutput): string {
  return (o["_str.title"] as string) || "Untitled Output";
}

export function projectMatchesRor(p: FWFProject, ror: string = ORG_ROR): boolean {
  const short = ror.replace(/^https?:\/\/ror\.org\//, "");
  const check = (s?: string) => !!s && (s === ror || s === short || s.includes(short));

  if (check(p["_str.principalinvestigator.researchinstitute.ror"])) return true;
  if ((p["_list.researchinstitutes"] || []).some(i => check(i.ror))) return true;
  if ((p["_list.keyresearchers"] || []).some(r => check(r.ror))) return true;
  return false;
}

export async function fetchAllOrgProjects(ror: string = ORG_ROR): Promise<FWFProject[]> {
  if (ror === ORG_ROR && projectsCache) return projectsCache;

  const short = ror.replace(/^https?:\/\/ror\.org\//, "");
  const loader = (async () => {
    const all: FWFProject[] = [];
    const limit = 1000;
    let offset = 0;

    while (true) {
      const hits = await postSearch<FWFProject>("projects", { q: short, limit, offset });
      const filteredHits = hits.filter((p: FWFProject) => projectMatchesRor(p, ror));
      all.push(...filteredHits);
      offset += limit;
      if (hits.length < limit || offset >= 3000) break;
    }

    return uniqById(all);
  })();

  if (ror === ORG_ROR) projectsCache = loader;
  return loader;
}

export async function fetchProjectById(projectId: string): Promise<FWFProject | null> {
  const projects = await fetchAllOrgProjects(ORG_ROR);
  return projects.find(p => p.id === projectId) || null;
}

export async function fetchOutputsByProjectId(projectId: string): Promise<FWFOutput[]> {
  const bareId = projectId.replace(/^project[-.]/i, "");
  const query = `"project-${bareId}"`;

  const outputs = await postSearch<FWFOutput>("output", { q: query, limit: 1000 });

  console.log(`Query ${query} returned ${outputs.length} outputs`);

  return outputs;
}

export async function fetchAllOutputsForOrgProjects(orgRor: string = ORG_ROR): Promise<FWFOutput[]> {
  const projects = await fetchAllOrgProjects(orgRor);

  console.log(`Found ${projects.length} projects for org ${orgRor}`);

  const projectsWithOutputs = projects.filter(
    p => (p["_list.connected.output"] || []).length > 0
  );

  console.log(
    `Found ${projectsWithOutputs.length} projects with connected outputs for org ${orgRor}`
  );

  const results = await Promise.all(
    projectsWithOutputs.map(async p => {
      const outputs = await fetchOutputsByProjectId(p.id);
      console.log(`Project ${p.id} has ${outputs.length} connected outputs`);
      return outputs;
    })
  );

  const allOutputs = uniqById(results.flat());

  console.log(`Fetched ${allOutputs.length} unique output records for org ${orgRor}`);

  return allOutputs;
}

export async function fetchOutputById(outputId: string): Promise<FWFOutput | null> {
  const hits = await postSearch<FWFOutput>("output", { q: `"${outputId}"`, limit: 20 }).catch(() => []);
  const exact = hits.find(o => o.id === outputId);
  if (exact) return exact;

  const outputs = await fetchAllOutputsForOrgProjects(ORG_ROR);
  return outputs.find(o => o.id === outputId) || hits[0] || null;
}

export async function fetchProjectsByOutputId(outputId: string): Promise<FWFProject[]> {
  const bareId = outputId.replace(/^output[-.]/i, "");
  const candidates = [
    `"${outputId}"`,
    `"output-${bareId}"`,
    `"output.${bareId}"`,
  ];

  const hits = await postSearch<FWFProject>("projects", {
    q: candidates.join(" OR "),
    limit: 100,
  });

  return uniqById(hits);
}

// ---------------------------------------------------------------------------
// Further Funding
// ---------------------------------------------------------------------------

export async function fetchFurtherFundingByProjectId(projectId: string): Promise<FWFFurtherFunding[]> {
  const bareId = projectId.replace(/^project[-.]/i, "");
  const query = `"project-${bareId}"`;
  const hits = await postSearch<FWFFurtherFunding>("further-funding", { q: query, limit: 1000 });
  console.log(`Further-funding query "${query}" returned ${hits.length} records`);
  return hits;
}

export async function fetchFurtherFundingById(fundingId: string): Promise<FWFFurtherFunding | null> {
  const hits = await postSearch<FWFFurtherFunding>("further-funding", { q: `"${fundingId}"`, limit: 20 }).catch(() => []);
  return hits.find(f => f.id === fundingId) || hits[0] || null;
}

export async function fetchProjectsByFurtherFundingId(fundingId: string): Promise<FWFProject[]> {
  const hits = await postSearch<FWFProject>("projects", { q: `"${fundingId}"`, limit: 100 }).catch(() => []);
  return uniqById(hits.filter(p => (p["_list.connected.further-funding"] || []).includes(fundingId)));
}

export function furtherFundingTitle(f: FWFFurtherFunding): string {
  return f["_str.title"] || f["_str.programname"] || f.id || "Untitled";
}

// ---------------------------------------------------------------------------
// Persons
// ---------------------------------------------------------------------------

export function buildPersonsIndex(projects: FWFProject[]): PersonRecord[] {
  const map = new Map<string, PersonRecord>();

  const upsert = (params: {
    name: string;
    institution?: string;
    orcid?: string;
    orcidLink?: string;
    webpage?: string;
    role: "PI" | "Researcher";
    project: FWFProject;
  }) => {
    const name = params.name.trim();
    if (!name) return;

    const institution = (params.institution || "").trim();
    const slug = personSlug(name, institution, params.orcid || "");
    const id = params.orcid ? `orcid:${params.orcid}` : `person:${slug}`;

    const existing = map.get(id) || {
      id,
      slug,
      name,
      institution,
      orcid: params.orcid,
      orcidLink: params.orcidLink,
      webpage: params.webpage,
      isPI: false,
      roles: [] as string[],
      projectIds: [] as string[],
      outputIds: [] as string[],
    };

    existing.isPI = existing.isPI || params.role === "PI";
    if (!existing.roles.includes(params.role)) existing.roles.push(params.role);
    if (!existing.projectIds.includes(params.project.id)) existing.projectIds.push(params.project.id);
    for (const outputId of params.project["_list.connected.output"] || []) {
      if (!existing.outputIds.includes(outputId)) existing.outputIds.push(outputId);
    }
    if (!existing.institution && institution) existing.institution = institution;
    if (!existing.orcid && params.orcid) existing.orcid = params.orcid;
    if (!existing.orcidLink && params.orcidLink) existing.orcidLink = params.orcidLink;
    if (!existing.webpage && params.webpage) existing.webpage = params.webpage;

    map.set(id, existing);
  };

  for (const project of projects) {
    const piName = [project["_str.principalinvestigator.firstname"], project["_str.principalinvestigator.lastname"]]
      .filter(Boolean)
      .join(" ");

    if (piName) {
      upsert({
        name: piName,
        institution: project["_str.principalinvestigator.researchinstitute.name"],
        orcid: project["_str.principalinvestigator.orcid"],
        orcidLink: project["_str.principalinvestigator.orcidlink"],
        webpage: project["_str.principalinvestigator.webpage"],
        role: "PI",
        project,
      });
    }

    for (const researcher of project["_list.keyresearchers"] || []) {
      if (!researcher?.name) continue;
      upsert({
        name: researcher.name,
        institution: researcher.institution,
        role: "Researcher",
        project,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchAllPersons(orgRor: string = ORG_ROR): Promise<PersonRecord[]> {
  if (orgRor === ORG_ROR && personsCache) return personsCache;
  const loader = fetchAllOrgProjects(orgRor).then(buildPersonsIndex);
  if (orgRor === ORG_ROR) personsCache = loader;
  return loader;
}

export async function fetchPersonBySlug(slug: string): Promise<PersonRecord | null> {
  const persons = await fetchAllPersons(ORG_ROR);
  return persons.find(p => p.slug === slug) || null;
}

export function textMatchProject(p: FWFProject, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return [
    p["_str.projecttitle.en"], p["_str.projecttitle.de"],
    p["_str.principalinvestigator.firstname"], p["_str.principalinvestigator.lastname"],
    p["_str.program.en"], p["_str.call.en"], p["_str.grantdoi"],
    p["_str.prproposalsummary.en"], p["_str.prproposalsummary.de"],
    ...(p["_list.keywords.split"] || []),
    ...(p["_list.researchdisciplines.en"] || []),
  ].some(v => !!v && String(v).toLowerCase().includes(lower));
}

export function textMatchOutput(o: FWFOutput, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  for (const val of Object.values(o)) {
    if (typeof val === "string" && val.toLowerCase().includes(lower)) return true;
    if (Array.isArray(val) && val.some(v => typeof v === "string" && v.toLowerCase().includes(lower))) return true;
  }
  return false;
}

export function textMatchPerson(p: PersonRecord, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return [p.name, p.institution, p.orcid, ...p.roles].some(v => !!v && v.toLowerCase().includes(lower));
}

export async function searchByDoi(doi: string): Promise<{ projects: FWFProject[]; outputs: FWFOutput[] }> {
  const q = doi.trim();
  const [projects, outputs] = await Promise.all([
    postSearch<FWFProject>("projects", { q, limit: 10 }),
    postSearch<FWFOutput>("output", { q, limit: 10 }),
  ]);
  return { projects, outputs };
}

export async function getIndexStats(): Promise<Record<string, { numberOfDocuments?: number; updatedAt?: string }>> {
  const res = await fetch(`${API_BASE}/indexes`, { headers: authHeaders() });
  if (!res.ok) return {};

  const data = await res.json();
  const result: Record<string, { numberOfDocuments?: number; updatedAt?: string }> = {};
  for (const idx of data.results || []) {
    result[idx.uid] = { numberOfDocuments: idx.numberOfDocuments, updatedAt: idx.updatedAt };
  }
  return result;
}

export function formatAmount(v?: number, currency = "EUR"): string {
  if (typeof v !== "number") return "";
  return new Intl.NumberFormat("de-AT", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

export function formatDate(v?: string): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function getYear(v?: string): number | null {
  if (!v) return null;
  const y = new Date(v).getFullYear();
  return Number.isFinite(y) ? y : null;
}

export function resetCaches() {
  projectsCache = null;
  outputsCache = null;
  personsCache = null;
}
