import React from "react";
import {
  fetchAllOrgProjects,
  fetchFurtherFundingByProjectId,
  furtherFundingTitle,
  formatAmount,
  formatDate,
  ORG_ROR,
  type FWFFurtherFunding,
} from "../api/fwf";
import { hrefFor, furtherFundingPath } from "../router";

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

function FacetList({ entries, selected, onToggle, maxVisible = 8 }: {
  entries: [string, number][];
  selected: Set<string>;
  onToggle: (v: string) => void;
  maxVisible?: number;
}) {
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
      {entries.length > maxVisible && (
        <button className="ql-facet-more" onClick={() => setExp(v => !v)}>
          {exp ? "Show less" : `+${entries.length - maxVisible} more`}
        </button>
      )}
    </>
  );
}

function textMatchFunding(f: FWFFurtherFunding, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  for (const val of Object.values(f)) {
    if (typeof val === "string" && val.toLowerCase().includes(lower)) return true;
    if (Array.isArray(val) && val.some(v => typeof v === "string" && v.toLowerCase().includes(lower))) return true;
  }
  return false;
}

function FurtherFundingCard({ f }: { f: FWFFurtherFunding }) {
  const title = furtherFundingTitle(f);
  const funder = f["_str.funder"];
  const funderAbbr = f["_str.funderabbreviation"];
  const program = f["_str.programname"];
  const grantNo = f["_str.grantnumber"];
  const amount = f["_long.approvedamount"];
  const currency = f["_str.currency"] || "EUR";
  const start = f["_date.startdate"];
  const end = f["_date.enddate"];
  const projectCount = (f["_list.connected.projects"] || []).length;

  return (
    <div className="ql-result-card">
      <div className="result-title">
        <a className="router-link" href={hrefFor(furtherFundingPath(f.id))}>{title}</a>
      </div>
      <div className="result-meta">
        {funderAbbr && <span className="result-badge badge-other">{funderAbbr}</span>}
        {funder && !funderAbbr && <span>{funder}</span>}
        {program && !title.includes(program) && <span>{program}</span>}
        {grantNo && <span className="mono-link">{grantNo}</span>}
        {typeof amount === "number" && <span>{formatAmount(amount, currency)}</span>}
        {start && <span>{formatDate(start)}{end ? ` – ${formatDate(end)}` : ""}</span>}
        {projectCount > 0 && (
          <span>{projectCount} project{projectCount !== 1 ? "s" : ""}</span>
        )}
      </div>
    </div>
  );
}

export function FurtherFundingPage() {
  const [allFundings, setAllFundings] = React.useState<FWFFurtherFunding[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [inputVal, setInputVal] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selFunder, setSelFunder] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setLoading(true);
    fetchAllOrgProjects(ORG_ROR)
      .then(async projects => {
        const projectsWithFF = projects.filter(
          p => (p["_list.connected.further-funding"] || []).length > 0
        );
        const results = await Promise.all(
          projectsWithFF.map(p => fetchFurtherFundingByProjectId(p.id))
        );
        // Deduplicate by id
        const seen = new Set<string>();
        const unique: FWFFurtherFunding[] = [];
        for (const batch of results) {
          for (const f of batch) {
            if (!seen.has(f.id)) {
              seen.add(f.id);
              unique.push(f);
            }
          }
        }
        // Sort by funder name then title
        unique.sort((a, b) => {
          const fa = (a["_str.funder"] || "").localeCompare(b["_str.funder"] || "");
          return fa !== 0 ? fa : furtherFundingTitle(a).localeCompare(furtherFundingTitle(b));
        });
        setAllFundings(unique);
      })
      .catch((e: any) => setError(e?.message || "Failed to load further fundings"))
      .finally(() => setLoading(false));
  }, []);

  const funderEntries = React.useMemo(
    () => Object.entries(countBy(allFundings, f => f["_str.funder"] || f["_str.funderabbreviation"] || null))
      .sort((a, b) => b[1] - a[1]),
    [allFundings]
  );

  const filtered = React.useMemo(() => {
    let list = allFundings;
    if (query) list = list.filter(f => textMatchFunding(f, query));
    if (selFunder.size > 0) list = list.filter(f => selFunder.has(f["_str.funder"] || f["_str.funderabbreviation"] || ""));
    return list;
  }, [allFundings, query, selFunder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageFundings = React.useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page]
  );
  React.useEffect(() => { if (page > totalPages - 1) setPage(0); }, [page, totalPages]);

  const hasActiveFilters = query || selFunder.size > 0;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Further Fundings</div>
        <p className="page-subtitle">Additional funding sources connected to FWF projects at this institution</p>
      </div>

      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-value">{loading ? "…" : allFundings.length}</div>
          <div className="stat-label">Total Further Fundings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{loading ? "…" : funderEntries.length}</div>
          <div className="stat-label">Unique Funders</div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="app-loading"><div className="spinner" /><span>Loading further fundings…</span></div>
      ) : (
        <div className="ql-grid">
          <aside className="ql-sidebar">
            <FacetBox title="Funder">
              <FacetList
                entries={funderEntries}
                selected={selFunder}
                onToggle={v => {
                  setSelFunder(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n; });
                  setPage(0);
                }}
                maxVisible={10}
              />
            </FacetBox>
          </aside>

          <div className="ql-right">
            <div className="ql-search-bar">
              <div className="ql-search-controls">
                <input
                  className="ql-search-input"
                  placeholder="Search further fundings..."
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { setQuery(inputVal); setPage(0); } }}
                />
                <button className="ql-btn-search" onClick={() => { setQuery(inputVal); setPage(0); }}>Search</button>
                {hasActiveFilters && (
                  <button className="ql-btn-reset" onClick={() => {
                    setInputVal(""); setQuery(""); setSelFunder(new Set()); setPage(0);
                  }}>Reset</button>
                )}
              </div>
            </div>

            <div className="ql-results-panel">
              <div className="ql-results-header">
                <div>
                  <span className="ql-results-title">Results</span>
                  <span className="ql-results-count">{filtered.length} funding{filtered.length !== 1 ? "s" : ""}</span>
                </div>
                <span className="ql-results-page">Page {Math.min(page + 1, totalPages)} / {totalPages}</span>
              </div>
              {pageFundings.length === 0 ? (
                <div className="empty-state">No further fundings found for this filter combination.</div>
              ) : (
                <>
                  {pageFundings.map(f => <FurtherFundingCard key={f.id} f={f} />)}
                  {totalPages > 1 && (
                    <div className="ql-pagination">
                      <button className="ql-page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
                      <span className="ql-page-label">Page {page + 1} of {totalPages}</span>
                      <button className="ql-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
