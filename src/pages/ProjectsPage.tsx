import React from "react";
import {
  fetchAllOrgProjects,
  fetchOutputsByProjectId,
  fetchFurtherFundingByProjectId,
  furtherFundingTitle,
  textMatchProject,
  formatAmount,
  formatDate,
  getYear,
  ORG_ROR,
  type FWFProject,
  type FWFOutput,
  type FWFFurtherFunding,
} from "../api/fwf";
import { hrefFor, outputPath, personPath, personSlug, projectPath, furtherFundingPath } from "../router";

const PAGE_SIZE = 20;

function isActiveStatus(s: string): boolean {
  const l = s.toLowerCase();
  return l.includes("ongoing") || l.includes("laufend") || l.includes("active");
}

function statusBadgeClass(s: string): string {
  const l = s.toLowerCase();
  if (l.includes("ongoing") || l.includes("laufend") || l.includes("active")) return "result-badge badge-active";
  if (l.includes("complet") || l.includes("abgeschl") || l.includes("ended")) return "result-badge badge-completed";
  return "result-badge badge-other";
}

function countBy<T>(arr: T[], fn: (x: T) => string | null): Record<string, number> {
  const c: Record<string, number> = {};
  for (const x of arr) {
    const k = fn(x);
    if (k) c[k] = (c[k] || 0) + 1;
  }
  return c;
}

function sortedEntries(obj: Record<string, number>): [string, number][] {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

function exportCsv(projects: FWFProject[]) {
  const cols: Array<[string, (p: FWFProject) => string]> = [
    ["ID", p => p.id],
    ["Title (EN)", p => p["_str.projecttitle.en"] || p["_str.projecttitle.de"] || ""],
    ["Status", p => p["_str.status.en"] || p["_str.status.de"] || ""],
    ["PI First Name", p => p["_str.principalinvestigator.firstname"] || ""],
    ["PI Last Name", p => p["_str.principalinvestigator.lastname"] || ""],
    ["Institution", p => p["_str.principalinvestigator.researchinstitute.name"] || ""],
    ["Programme", p => p["_str.program.en"] || p["_str.program.de"] || ""],
    ["Approved Amount", p => p["_long.approvedamount"] ? String(p["_long.approvedamount"]) : ""],
    ["Start Date", p => p["_date.startdate"] || ""],
    ["End Date", p => p["_date.enddate"] || ""],
    ["Grant DOI", p => p["_str.grantdoi"] || ""],
    ["Further Funding Count", p => String((p["_list.connected.further-funding"] || []).length)],
  ];

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = cols.map(([h]) => escape(h)).join(",");
  const rows = projects.map(p => cols.map(([, fn]) => escape(fn(p))).join(","));
  const csv = [header, ...rows].join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fwf-projects-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function JsonModal({ data, onClose }: { data: unknown; onClose: () => void }) {
  return (
    <div className="json-modal-backdrop" onClick={onClose}>
      <div className="json-modal" onClick={e => e.stopPropagation()}>
        <div className="json-modal-header">
          <span>Raw JSON response</span>
          <button className="json-modal-close" onClick={onClose}>✕</button>
        </div>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}

function FacetBox({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="ql-facet-box"><div className="ql-facet-title">{title}</div>{children}</div>;
}

function FacetList({ entries, selected, onToggle, maxVisible = 8 }: { entries: [string, number][]; selected: Set<string>; onToggle: (v: string) => void; maxVisible?: number; }) {
  const [exp, setExp] = React.useState(false);
  const visible = exp ? entries : entries.slice(0, maxVisible);
  if (entries.length === 0) return <div className="ql-facet-status">No values</div>;
  return (
    <>
      <div className="ql-facet-list">
        {visible.map(([val, count]) => (
          <label key={val} className="ql-facet-label">
            <input type="checkbox" checked={selected.has(val)} onChange={() => onToggle(val)} />
            <span className="ql-facet-label-text">{val}</span>
            <span className="ql-facet-count">{count}</span>
          </label>
        ))}
      </div>
      {entries.length > maxVisible && <button className="ql-facet-more" onClick={() => setExp(v => !v)}>{exp ? "Show less" : `+${entries.length - maxVisible} more`}</button>}
    </>
  );
}

function YearRangeInput({ min: selMin, max: selMax, years, onChange }: { min: number | null; max: number | null; years: number[]; onChange: (min: number | null, max: number | null) => void; }) {
  if (years.length === 0) return <div className="ql-facet-status">No data</div>;
  const lo = Math.min(...years), hi = Math.max(...years);
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input type="number" className="year-input" placeholder={String(lo)} value={selMin ?? ""} min={lo} max={hi} onChange={e => onChange(e.target.value ? +e.target.value : null, selMax)} />
      <span style={{ color: "var(--muted)", fontSize: 12 }}>–</span>
      <input type="number" className="year-input" placeholder={String(hi)} value={selMax ?? ""} min={lo} max={hi} onChange={e => onChange(selMin, e.target.value ? +e.target.value : null)} />
      {(selMin || selMax) && <button className="ql-facet-more" style={{ marginTop: 0 }} onClick={() => onChange(null, null)}>Clear</button>}
    </div>
  );
}

function ProjectCard({ project }: { project: FWFProject }) {
  const [expanded, setExpanded] = React.useState(false);
  const [showJson, setShowJson] = React.useState(false);
  const [outputs, setOutputs] = React.useState<FWFOutput[]>([]);
  const [furtherFundings, setFurtherFundings] = React.useState<FWFFurtherFunding[]>([]);
  const [loadingOut, setLoadingOut] = React.useState(false);
  const [loadingFF, setLoadingFF] = React.useState(false);

  const title = project["_str.projecttitle.en"] || project["_str.projecttitle.de"] || "Untitled";
  const pi = [project["_str.principalinvestigator.firstname"], project["_str.principalinvestigator.lastname"]].filter(Boolean).join(" ");
  const institute = project["_str.principalinvestigator.researchinstitute.name"] || "";
  const status = project["_str.status.en"] || project["_str.status.de"] || "";
  const program = project["_str.program.en"] || project["_str.program.de"] || "";
  const grantDoi = project["_str.grantdoi"] || "";
  const amount = project["_long.approvedamount"];
  const start = project["_date.startdate"];
  const end = project["_date.enddate"];
  const keywords = project["_list.keywords.split"] || [];
  const summary = project["_str.prproposalsummary.en"] || project["_str.prproposalsummary.de"] || "";
  const url = project["_str.url"] || "";
  const orcidLink = project["_str.principalinvestigator.orcidlink"] || "";
  const disciplines = project["_list.researchdisciplines.en"] || [];
  const outputCount = (project["_list.connected.output"] || []).length;
  const ffCount = (project["_list.connected.further-funding"] || []).length;
  const piSlug = pi ? personSlug(pi, institute, project["_str.principalinvestigator.orcid"] || "") : "";

  React.useEffect(() => {
    if (expanded && outputs.length === 0 && outputCount > 0) {
      setLoadingOut(true);
      fetchOutputsByProjectId(project.id)
        .then(setOutputs)
        .catch(() => setOutputs([]))
        .finally(() => setLoadingOut(false));
    }
    if (expanded && furtherFundings.length === 0 && ffCount > 0) {
      setLoadingFF(true);
      fetchFurtherFundingByProjectId(project.id)
        .then(setFurtherFundings)
        .catch(() => setFurtherFundings([]))
        .finally(() => setLoadingFF(false));
    }
  }, [expanded, outputs.length, outputCount, furtherFundings.length, ffCount, project.id]);

  return (
    <>
      {showJson && <JsonModal data={project} onClose={() => setShowJson(false)} />}
      <div className={`ql-result-card${expanded ? " ql-result-card--expanded" : ""}`} onClick={() => setExpanded(v => !v)}>
        <div className="result-title"><a className="router-link" href={hrefFor(projectPath(project.id))} onClick={e => e.stopPropagation()}>{title}</a></div>
        <div className="result-meta">
          {status && <span className={statusBadgeClass(status)}>{status}</span>}
          {amount && <span className="result-amount">{formatAmount(amount)}</span>}
          {program && <span className="result-program">{program}</span>}
          {pi && <span>{piSlug ? <a className="router-link" href={hrefFor(personPath(piSlug))} onClick={e => e.stopPropagation()}>{pi}</a> : pi}{institute && ` · ${institute}`}</span>}
          {start && <span>{formatDate(start)} – {formatDate(end)}</span>}
          {ffCount > 0 && (
            <span className="result-badge badge-other" title="Has further funding records">
              +{ffCount} further funding
            </span>
          )}
        </div>

        {expanded && (
          <div className="result-expand" onClick={e => e.stopPropagation()}>
            <div className="result-expand-grid">
              {summary && <div className="expand-field" style={{ gridColumn: "1 / -1" }}><h4>Summary</h4><p style={{ color: "var(--muted)" }}>{summary}</p></div>}
              {grantDoi && <div className="expand-field"><h4>Grant DOI</h4><a className="mono-link" href={`https://doi.org/${grantDoi.replace(/^https?:\/\/doi\.org\//, "")}`} target="_blank" rel="noopener noreferrer">{grantDoi}</a></div>}
              {orcidLink && <div className="expand-field"><h4>PI ORCID</h4><a className="mono-link" href={orcidLink} target="_blank" rel="noopener noreferrer">{project["_str.principalinvestigator.orcid"] || orcidLink}</a></div>}
              {url && <div className="expand-field"><h4>Research Radar</h4><a className="mono-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a></div>}
              {disciplines.length > 0 && <div className="expand-field"><h4>Disciplines</h4><p>{disciplines.join(", ")}</p></div>}
              {keywords.length > 0 && <div className="expand-field" style={{ gridColumn: "1 / -1" }}><h4>Keywords</h4><div>{keywords.slice(0, 20).map((kw, i) => <span key={i} className="kw-chip">{kw}</span>)}</div></div>}
            </div>

            {/* Further Funding section */}
            {ffCount > 0 && (
              <div className="expand-field" style={{ gridColumn: "1 / -1", marginTop: 12 }}>
                <h4>Further Funding ({ffCount})</h4>
                {loadingFF ? (
                  <div className="mini-spinner">Loading further funding…</div>
                ) : furtherFundings.length > 0 ? (
                  <ul className="output-mini-list">
                    {furtherFundings.map(ff => (
                      <li key={ff.id}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          <a className="router-link" href={hrefFor(furtherFundingPath(ff.id))}>
                            {furtherFundingTitle(ff)}
                          </a>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {[
                            ff["_str.funderabbreviation"] || ff["_str.funder"],
                            ff["_str.grantnumber"],
                          ].filter(Boolean).join(" · ")}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--muted)" }}>No further funding details found.</p>
                )}
              </div>
            )}

            <div className="expand-field" style={{ gridColumn: "1 / -1" }}>
              <h4>Related Outputs ({outputCount})</h4>
              {loadingOut ? <div className="mini-spinner">Loading related outputs…</div> : outputs.length > 0 ? <ul className="output-mini-list">{outputs.map(out => <li key={out.id}><div style={{ fontWeight: 700, fontSize: 14 }}><a className="router-link" href={hrefFor(outputPath(String(out.id)))}>{String(out["_str.title"] || out.id)}</a></div><div style={{ fontSize: 12, color: "var(--muted)" }}>{String(out["_str.category"] || "")}{out["_str.year"] ? ` (${String(out["_str.year"])})` : ""}</div></li>)}</ul> : <p style={{ fontSize: 12, color: "var(--muted)" }}>{outputCount > 0 ? "No output details found for this project." : "This project has no related outputs."}</p>}
            </div>

            <div className="result-expand-actions">
              <a className="btn btn-export" href={hrefFor(projectPath(project.id))}>Open detail page</a>
              <button className="json-btn" onClick={() => setShowJson(true)}>{"{ }"} Show JSON</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function ProjectsPage() {
  const [allProjects, setAllProjects] = React.useState<FWFProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [inputVal, setInputVal] = React.useState("");
  const [page, setPage] = React.useState(0);

  const [selStatus, setSelStatus] = React.useState<Set<string>>(new Set());
  const [selProgram, setSelProgram] = React.useState<Set<string>>(new Set());
  const [selDiscipline, setSelDiscipline] = React.useState<Set<string>>(new Set());
  const [startMin, setStartMin] = React.useState<number | null>(null);
  const [startMax, setStartMax] = React.useState<number | null>(null);
  const [onlyWithOutputs, setOnlyWithOutputs] = React.useState(false);
  const [onlyWithFurtherFunding, setOnlyWithFurtherFunding] = React.useState(false);

  React.useEffect(() => {
    fetchAllOrgProjects(ORG_ROR)
      .then(ps => { setAllProjects(ps); setLoading(false); })
      .catch((e: any) => { setError(e?.message || "Failed to load projects"); setLoading(false); });
  }, []);

  const statusEntries = React.useMemo(() => sortedEntries(countBy(allProjects, p => p["_str.status.en"] || p["_str.status.de"] || null)), [allProjects]);
  const programEntries = React.useMemo(() => sortedEntries(countBy(allProjects, p => p["_str.program.en"] || p["_str.program.de"] || null)), [allProjects]);
  const disciplineEntries = React.useMemo(() => sortedEntries(countBy(allProjects.flatMap(p => (p["_list.researchdisciplines.en"] || []).map(d => ({ d }))), x => x.d || null)), [allProjects]);
  const years = React.useMemo(() => allProjects.map(p => getYear(p["_date.startdate"]) || 0).filter(Boolean), [allProjects]);

  const withFurtherFundingCount = React.useMemo(
    () => allProjects.filter(p => (p["_list.connected.further-funding"] || []).length > 0).length,
    [allProjects]
  );

  const filtered = React.useMemo(() => {
    let list = allProjects;
    if (query) list = list.filter(p => textMatchProject(p, query));
    if (selStatus.size > 0) list = list.filter(p => selStatus.has(p["_str.status.en"] || p["_str.status.de"] || ""));
    if (selProgram.size > 0) list = list.filter(p => selProgram.has(p["_str.program.en"] || p["_str.program.de"] || ""));
    if (selDiscipline.size > 0) list = list.filter(p => (p["_list.researchdisciplines.en"] || []).some(d => selDiscipline.has(d)));
    if (startMin !== null) list = list.filter(p => { const y = getYear(p["_date.startdate"]) || 0; return !y || y >= startMin; });
    if (startMax !== null) list = list.filter(p => { const y = getYear(p["_date.startdate"]) || 0; return !y || y <= startMax; });
    if (onlyWithOutputs) list = list.filter(p => (p["_list.connected.output"] || []).length > 0);
    if (onlyWithFurtherFunding) list = list.filter(p => (p["_list.connected.further-funding"] || []).length > 0);
    return list;
  }, [allProjects, query, selStatus, selProgram, selDiscipline, startMin, startMax, onlyWithOutputs, onlyWithFurtherFunding]);

  const pageTotal = filtered.length;
  const totalPages = Math.max(1, Math.ceil(pageTotal / PAGE_SIZE));
  const pageProjects = React.useMemo(() => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [filtered, page]);
  React.useEffect(() => { if (page > totalPages - 1) setPage(0); }, [page, totalPages]);

  const hasActiveFilters = query || selStatus.size || selProgram.size || selDiscipline.size || startMin !== null || startMax !== null || onlyWithOutputs || onlyWithFurtherFunding;

  return (
    <div>
      <div className="page-header"><div className="page-title">Projects</div><p className="page-subtitle">FWF-funded research projects at this institution</p></div>
      <div className="stats-bar">
        <div className="stat-card"><div className="stat-value">{loading ? "…" : allProjects.length}</div><div className="stat-label">Total Projects</div></div>
        <div className="stat-card"><div className="stat-value">{loading ? "…" : allProjects.filter(p => isActiveStatus(p["_str.status.en"] || p["_str.status.de"] || "")).length}</div><div className="stat-label">Active Projects</div></div>
        <div className="stat-card"><div className="stat-value">{loading ? "…" : withFurtherFundingCount}</div><div className="stat-label">With Further Funding</div></div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? <div className="app-loading"><div className="spinner" /><span>Loading projects…</span></div> : <div className="ql-grid">
        <aside className="ql-sidebar">
          <FacetBox title="Status"><FacetList entries={statusEntries} selected={selStatus} onToggle={v => { setSelStatus(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; }); setPage(0); }} /></FacetBox>
          <FacetBox title="Programme"><FacetList entries={programEntries} selected={selProgram} onToggle={v => { setSelProgram(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; }); setPage(0); }} /></FacetBox>
          <FacetBox title="Start Year"><YearRangeInput min={startMin} max={startMax} years={years} onChange={(a, b) => { setStartMin(a); setStartMax(b); setPage(0); }} /></FacetBox>
          <FacetBox title="Disciplines"><FacetList entries={disciplineEntries} selected={selDiscipline} onToggle={v => { setSelDiscipline(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; }); setPage(0); }} maxVisible={10} /></FacetBox>
          <FacetBox title="Options">
            <label className="ql-facet-label">
              <input type="checkbox" checked={onlyWithOutputs} onChange={e => { setOnlyWithOutputs(e.target.checked); setPage(0); }} />
              <span className="ql-facet-label-text">Has related outputs</span>
            </label>
            <label className="ql-facet-label">
              <input type="checkbox" checked={onlyWithFurtherFunding} onChange={e => { setOnlyWithFurtherFunding(e.target.checked); setPage(0); }} />
              <span className="ql-facet-label-text">Has further funding</span>
              {!loading && <span className="ql-facet-count">{withFurtherFundingCount}</span>}
            </label>
          </FacetBox>
        </aside>
        <div className="ql-right">
          <div className="ql-search-bar"><div className="ql-search-controls"><input className="ql-search-input" placeholder="Search all projects..." value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { setQuery(inputVal); setPage(0); } }} /><button className="ql-btn-search" onClick={() => { setQuery(inputVal); setPage(0); }}>Search</button><button className="btn btn-export" onClick={() => exportCsv(filtered)}>Export CSV</button>{hasActiveFilters ? <button className="ql-btn-reset" onClick={() => { setInputVal(""); setQuery(""); setSelStatus(new Set()); setSelProgram(new Set()); setSelDiscipline(new Set()); setStartMin(null); setStartMax(null); setOnlyWithOutputs(false); setOnlyWithFurtherFunding(false); setPage(0); }}>Reset</button> : null}</div></div>
          <div className="ql-results-panel"><div className="ql-results-header"><div><span className="ql-results-title">Results</span><span className="ql-results-count">{pageTotal} project{pageTotal !== 1 ? "s" : ""}</span></div><span className="ql-results-page">Page {Math.min(page + 1, totalPages)} / {totalPages}</span></div>
            {pageProjects.length === 0 ? <div className="empty-state">No projects found for this filter combination.</div> : <>{pageProjects.map(project => <ProjectCard key={project.id} project={project} />)}{totalPages > 1 && <div className="ql-pagination"><button className="ql-page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button><span className="ql-page-label">Page {page + 1} of {totalPages}</span><button className="ql-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button></div>}</>}
          </div>
        </div>
      </div>}
    </div>
  );
}
