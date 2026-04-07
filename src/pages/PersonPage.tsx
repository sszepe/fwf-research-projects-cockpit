import React from "react";
import { fetchAllPersons, textMatchPerson, type PersonRecord } from "../api/fwf";
import { hrefFor, personPath } from "../router";

const PAGE_SIZE = 20;

function countBy<T>(arr: T[], fn: (x: T) => string | null): Record<string, number> {
  const c: Record<string, number> = {};
  for (const x of arr) {
    const k = fn(x);
    if (k) c[k] = (c[k] || 0) + 1;
  }
  return c;
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
      <div className="ql-facet-list">{visible.map(([val, count]) => <label key={val} className="ql-facet-label"><input type="checkbox" checked={selected.has(val)} onChange={() => onToggle(val)} /><span className="ql-facet-label-text">{val}</span><span className="ql-facet-count">{count}</span></label>)}</div>
      {entries.length > maxVisible && <button className="ql-facet-more" onClick={() => setExp(v => !v)}>{exp ? "Show less" : `+${entries.length - maxVisible} more`}</button>}
    </>
  );
}

function PersonCard({ person }: { person: PersonRecord }) {
  return (
    <div className="ql-result-card">
      <div className="result-title"><a className="router-link" href={hrefFor(personPath(person.slug))}>{person.name}</a></div>
      <div className="result-meta">
        {person.isPI && <span className="result-badge badge-active">PI</span>}
        {person.institution && <span>{person.institution}</span>}
        {person.roles.length > 0 && <span>{person.roles.join(", ")}</span>}
        <span>{person.projectIds.length} project{person.projectIds.length !== 1 ? "s" : ""}</span>
        <span>{person.outputIds.length} output{person.outputIds.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

export function PersonPage() {
  const [persons, setPersons] = React.useState<PersonRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [inputVal, setInputVal] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [onlyPI, setOnlyPI] = React.useState(false);
  const [selInstitution, setSelInstitution] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    fetchAllPersons()
      .then(ps => setPersons(ps))
      .catch((e: any) => setError(e?.message || "Failed to load persons"))
      .finally(() => setLoading(false));
  }, []);

  const institutionEntries = React.useMemo(() => Object.entries(countBy(persons, p => p.institution || null)).sort((a, b) => b[1] - a[1]), [persons]);
  const filtered = React.useMemo(() => {
    let list = persons;
    if (query) list = list.filter(p => textMatchPerson(p, query));
    if (onlyPI) list = list.filter(p => p.isPI);
    if (selInstitution.size > 0) list = list.filter(p => selInstitution.has(p.institution));
    return list;
  }, [persons, query, onlyPI, selInstitution]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagePersons = React.useMemo(() => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [filtered, page]);
  React.useEffect(() => { if (page > totalPages - 1) setPage(0); }, [page, totalPages]);

  return (
    <div>
      <div className="page-header"><div className="page-title">Persons</div><p className="page-subtitle">Researchers and principal investigators connected to this institution's FWF projects</p></div>
      <div className="stats-bar"><div className="stat-card"><div className="stat-value">{loading ? "…" : persons.length}</div><div className="stat-label">Total Persons</div></div><div className="stat-card"><div className="stat-value">{loading ? "…" : persons.filter(p => p.isPI).length}</div><div className="stat-label">Principal Investigators</div></div></div>
      {error && <div className="error-banner">{error}</div>}
      {loading ? <div className="app-loading"><div className="spinner" /><span>Loading persons…</span></div> : <div className="ql-grid">
        <aside className="ql-sidebar">
          <FacetBox title="Options"><label className="ql-facet-label"><input type="checkbox" checked={onlyPI} onChange={e => { setOnlyPI(e.target.checked); setPage(0); }} /><span className="ql-facet-label-text">Principal investigators only</span></label></FacetBox>
          <FacetBox title="Institution"><FacetList entries={institutionEntries} selected={selInstitution} onToggle={v => { setSelInstitution(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; }); setPage(0); }} maxVisible={10} /></FacetBox>
        </aside>
        <div className="ql-right">
          <div className="ql-search-bar"><div className="ql-search-controls"><input className="ql-search-input" placeholder="Search persons..." value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { setQuery(inputVal); setPage(0); } }} /><button className="ql-btn-search" onClick={() => { setQuery(inputVal); setPage(0); }}>Search</button>{(query || onlyPI || selInstitution.size > 0) && <button className="ql-btn-reset" onClick={() => { setInputVal(""); setQuery(""); setOnlyPI(false); setSelInstitution(new Set()); setPage(0); }}>Reset</button>}</div></div>
          <div className="ql-results-panel"><div className="ql-results-header"><div><span className="ql-results-title">Results</span><span className="ql-results-count">{filtered.length} person{filtered.length !== 1 ? "s" : ""}</span></div><span className="ql-results-page">Page {Math.min(page + 1, totalPages)} / {totalPages}</span></div>
            {pagePersons.length === 0 ? <div className="empty-state">No persons found for this filter combination.</div> : <>{pagePersons.map(person => <PersonCard key={person.id} person={person} />)}{totalPages > 1 && <div className="ql-pagination"><button className="ql-page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button><span className="ql-page-label">Page {page + 1} of {totalPages}</span><button className="ql-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button></div>}</>}
          </div>
        </div>
      </div>}
    </div>
  );
}
