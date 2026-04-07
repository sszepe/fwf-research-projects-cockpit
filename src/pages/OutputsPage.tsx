import React from "react";
import {
  OUTPUT_CATEGORIES,
  fetchAllOutputsForOrgProjects,
  textMatchOutput,
  ORG_ROR,
  type FWFOutput,
  type OutputCategoryKey,
} from "../api/fwf";
import { hrefFor, outputPath } from "../router";

const PAGE_SIZE = 20;

function getStr(o: FWFOutput, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k];
    if (v && typeof v === "string") return v;
  }
  return "";
}

function countBy<T>(arr: T[], fn: (x: T) => string | null): Record<string, number> {
  const c: Record<string, number> = {};
  for (const x of arr) {
    const k = fn(x);
    if (k) c[k] = (c[k] || 0) + 1;
  }
  return c;
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
          <label key={val} className="ql-facet-label"><input type="checkbox" checked={selected.has(val)} onChange={() => onToggle(val)} /><span className="ql-facet-label-text">{val}</span><span className="ql-facet-count">{count}</span></label>
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

function OutputCard({ o }: { o: FWFOutput }) {
  const [showJson, setShowJson] = React.useState(false);
  const title = getStr(o, "_str.title", "title") || "Untitled";
  const doi = getStr(o, "_str.doi", "doi");
  const year = getStr(o, "_str.year", "year");
  const authors = getStr(o, "_str.authors", "authors");
  const journal = getStr(o, "_str.journal", "journal") || getStr(o, "_str.publisher", "publisher");
  const pmid = getStr(o, "_str.pmid", "pmid");
  const isbn = getStr(o, "_str.isbn", "isbn");

  return (
    <>
      {showJson && <JsonModal data={o} onClose={() => setShowJson(false)} />}
      <div className="ql-result-card">
        <div className="result-title"><a className="router-link" href={hrefFor(outputPath(String(o.id)))}>{title}</a></div>
        <div className="result-meta">
          {year && <span className="result-badge badge-other">{year}</span>}
          {authors && <span>{authors}</span>}
          {journal && <span>{journal}</span>}
          {doi && <a href={`https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, "")}`} className="mono-link" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>DOI</a>}
          {pmid && <a href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}`} className="mono-link" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>PubMed</a>}
          {isbn && <span className="mono-link">ISBN {isbn}</span>}
        </div>
        <button className="json-btn" onClick={e => { e.stopPropagation(); setShowJson(true); }}>{"{ }"} Show JSON</button>
      </div>
    </>
  );
}

export function OutputsPage() {
  const [activeCategory, setActiveCategory] = React.useState<OutputCategoryKey>("all");
  const [inputVal, setInputVal] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [allOutputs, setAllOutputs] = React.useState<FWFOutput[]>([]);
  const [allLoading, setAllLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [error, setError] = React.useState("");
  const [selJournal, setSelJournal] = React.useState<Set<string>>(new Set());
  const [yearMin, setYearMin] = React.useState<number | null>(null);
  const [yearMax, setYearMax] = React.useState<number | null>(null);

  React.useEffect(() => {
    setAllLoading(true);
    setError("");
    fetchAllOutputsForOrgProjects(ORG_ROR)
      .then(d => setAllOutputs(d))
      .catch((e: any) => setError(e?.message || "Failed to load outputs"))
      .finally(() => setAllLoading(false));
  }, []);

  const handleCategoryChange = (cat: OutputCategoryKey) => {
    setActiveCategory(cat);
    setPage(0);
    setSelJournal(new Set());
    setYearMin(null);
    setYearMax(null);
  };

  const catCounts = React.useMemo(() => {
    const c: Record<string, number> = { all: allOutputs.length };
    for (const o of allOutputs) {
      const k = (o["_str.category"] || "").toLowerCase();
      if (k) c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [allOutputs]);

  const outputsForFacets = React.useMemo(() => activeCategory === "all" ? allOutputs : allOutputs.filter(o => (o["_str.category"] || "").toLowerCase() === activeCategory.toLowerCase()), [allOutputs, activeCategory]);
  const journalEntries = React.useMemo(() => Object.entries(countBy(outputsForFacets, o => getStr(o, "_str.journal", "journal") || getStr(o, "_str.publisher", "publisher") || null)).filter(([k]) => k).sort((a, b) => b[1] - a[1]), [outputsForFacets]);
  const pubYears = React.useMemo(() => outputsForFacets.map(o => parseInt(getStr(o, "_str.year", "year") || "0", 10)).filter(y => y > 1900), [outputsForFacets]);

  const filteredOutputs = React.useMemo(() => {
    let list = outputsForFacets;
    if (query) list = list.filter(o => textMatchOutput(o, query));
    if (selJournal.size > 0) list = list.filter(o => selJournal.has(getStr(o, "_str.journal", "journal") || getStr(o, "_str.publisher", "publisher")));
    if (yearMin !== null) list = list.filter(o => { const y = parseInt(getStr(o, "_str.year", "year") || "0", 10); return !y || y >= yearMin; });
    if (yearMax !== null) list = list.filter(o => { const y = parseInt(getStr(o, "_str.year", "year") || "0", 10); return !y || y <= yearMax; });
    return list;
  }, [outputsForFacets, query, selJournal, yearMin, yearMax]);

  const pageTotal = filteredOutputs.length;
  const totalPages = Math.max(1, Math.ceil(pageTotal / PAGE_SIZE));
  const pageOutputs = React.useMemo(() => filteredOutputs.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [filteredOutputs, page]);
  React.useEffect(() => { if (page > totalPages - 1) setPage(0); }, [page, totalPages]);

  return (
    <div>
      <div className="page-header"><div className="page-title">Research Outputs</div><p className="page-subtitle">Publications and other outputs from FWF-funded research at this institution</p></div>
      <div className="stats-bar"><div className="stat-card"><div className="stat-value">{allLoading ? "…" : allOutputs.length}</div><div className="stat-label">Total Outputs</div></div></div>

      <div className="ql-tabs-row"><div className="ql-tabs"><button className={`ql-tab${activeCategory === "all" ? " ql-tab--active" : ""}`} onClick={() => handleCategoryChange("all")}>All <span className="tab-count">{allLoading ? "…" : allOutputs.length}</span></button>{OUTPUT_CATEGORIES.map(c => <button key={c.key} className={`ql-tab${activeCategory === c.key ? " ql-tab--active" : ""}`} onClick={() => handleCategoryChange(c.key)}>{c.label}{!allLoading && <span className="tab-count">{catCounts[c.key] ?? 0}</span>}</button>)}</div></div>
      {error && <div className="error-banner">{error}</div>}
      {allLoading ? <div className="app-loading"><div className="spinner" /><span>Loading outputs…</span></div> : <div className="ql-grid">
        <aside className="ql-sidebar">
          <FacetBox title="Publication Year"><YearRangeInput years={pubYears} min={yearMin} max={yearMax} onChange={(a, b) => { setYearMin(a); setYearMax(b); setPage(0); }} /></FacetBox>
          <FacetBox title="Journal / Publisher"><FacetList entries={journalEntries} selected={selJournal} onToggle={v => { setSelJournal(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; }); setPage(0); }} maxVisible={10} /></FacetBox>
        </aside>
        <div className="ql-right">
          <div className="ql-search-bar"><div className="ql-search-controls"><input className="ql-search-input" placeholder="Search all outputs..." value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { setQuery(inputVal); setPage(0); } }} /><button className="ql-btn-search" onClick={() => { setQuery(inputVal); setPage(0); }}>Search</button>{(query || selJournal.size || yearMin !== null || yearMax !== null) ? <button className="ql-btn-reset" onClick={() => { setInputVal(""); setQuery(""); setSelJournal(new Set()); setYearMin(null); setYearMax(null); setPage(0); }}>Reset</button> : null}</div></div>
          <div className="ql-results-panel"><div className="ql-results-header"><div><span className="ql-results-title">Results</span><span className="ql-results-count">{pageTotal} output{pageTotal !== 1 ? "s" : ""}</span></div><span className="ql-results-page">Page {Math.min(page + 1, totalPages)} / {totalPages}</span></div>
            {pageOutputs.length === 0 ? <div className="empty-state">No outputs found for this filter combination.</div> : <>{pageOutputs.map(o => <OutputCard key={String(o.id)} o={o} />)}{totalPages > 1 && <div className="ql-pagination"><button className="ql-page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button><span className="ql-page-label">Page {page + 1} of {totalPages}</span><button className="ql-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button></div>}</>}
          </div>
        </div>
      </div>}
    </div>
  );
}
