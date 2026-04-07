import React from "react";
import { searchByDoi, formatAmount, formatDate, type FWFProject, type FWFOutput } from "../api/fwf";

function JsonModal({ data, onClose }: { data: unknown; onClose: () => void }) {
  return (
    <div className="json-modal-backdrop" onClick={onClose}>
      <div className="json-modal" onClick={e => e.stopPropagation()}>
        <div className="json-modal-header">
          <span>Raw JSON</span>
          <button className="json-modal-close" onClick={onClose}>✕</button>
        </div>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null;
  return (
    <tr>
      <td>{label}</td>
      <td>{value}</td>
    </tr>
  );
}

function ProjectResult({ p }: { p: FWFProject }) {
  const [showJson, setShowJson] = React.useState(false);
  const title = p["_str.projecttitle.en"] || p["_str.projecttitle.de"] || "Untitled";
  const pi = [p["_str.principalinvestigator.firstname"], p["_str.principalinvestigator.lastname"]].filter(Boolean).join(" ");
  const grantDoi = p["_str.grantdoi"];
  return (
    <>
      {showJson && <JsonModal data={p} onClose={() => setShowJson(false)} />}
      <div className="ql-results-panel" style={{ marginBottom: 14 }}>
        <div className="ql-results-header">
          <span className="ql-results-title">Project: {title}</span>
        </div>
        <div style={{ padding: "12px 14px" }}>
          <table className="field-table">
            <tbody>
              <FieldRow label="Status" value={p["_str.status.en"]} />
              <FieldRow label="PI" value={pi} />
              <FieldRow label="Institution" value={p["_str.principalinvestigator.researchinstitute.name"]} />
              <FieldRow label="Programme" value={p["_str.program.en"] || p["_str.program.de"]} />
              <FieldRow label="Approved Amount" value={formatAmount(p["_long.approvedamount"])} />
              <FieldRow label="Start" value={formatDate(p["_date.startdate"])} />
              <FieldRow label="End" value={formatDate(p["_date.enddate"])} />
              <FieldRow label="Grant DOI" value={grantDoi && <a className="mono-link" href={`https://doi.org/${grantDoi.replace(/^https?:\/\/doi\.org\//, "")}`} target="_blank" rel="noopener noreferrer">{grantDoi}</a>} />
              <FieldRow label="ORCID" value={p["_str.principalinvestigator.orcidlink"] && <a className="mono-link" href={p["_str.principalinvestigator.orcidlink"]} target="_blank" rel="noopener noreferrer">{p["_str.principalinvestigator.orcid"] || p["_str.principalinvestigator.orcidlink"]}</a>} />
              <FieldRow label="Research Radar" value={p["_str.url"] && <a className="mono-link" href={p["_str.url"]} target="_blank" rel="noopener noreferrer">{p["_str.url"]}</a>} />
            </tbody>
          </table>
          {p["_str.prproposalsummary.en"] && (
            <div style={{ marginTop: 10, padding: "10px 0", borderTop: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9ca3af", marginBottom: 6 }}>Summary</div>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>{p["_str.prproposalsummary.en"]}</p>
            </div>
          )}
          {(p["_list.keywords.split"] || []).length > 0 && (
            <div style={{ marginTop: 8 }}>
              {(p["_list.keywords.split"] || []).map((kw, i) => <span key={i} className="kw-chip">{kw}</span>)}
            </div>
          )}
          <button className="json-btn" onClick={() => setShowJson(true)}>{"{ }"} Show JSON</button>
        </div>
      </div>
    </>
  );
}

function OutputResult({ o }: { o: FWFOutput }) {
  const [showJson, setShowJson] = React.useState(false);
  const getStr = (...keys: string[]) => { for (const k of keys) { const v = o[k]; if (v && typeof v === "string") return v; } return ""; };
  const title = getStr("_str.title", "title") || "Untitled";
  const cat   = getStr("_str.category", "category");
  const doi   = getStr("_str.doi", "doi");
  return (
    <>
      {showJson && <JsonModal data={o} onClose={() => setShowJson(false)} />}
      <div className="ql-results-panel" style={{ marginBottom: 14 }}>
        <div className="ql-results-header">
          <span className="ql-results-title">{cat ? `${cat}: ` : ""}{title}</span>
        </div>
        <div style={{ padding: "12px 14px" }}>
          <table className="field-table">
            <tbody>
              <FieldRow label="Authors" value={getStr("_str.authors", "authors")} />
              <FieldRow label="Year" value={getStr("_str.year", "year")} />
              <FieldRow label="Journal" value={getStr("_str.journal", "journal") || getStr("_str.publisher", "publisher")} />
              <FieldRow label="DOI" value={doi && <a className="mono-link" href={`https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, "")}`} target="_blank" rel="noopener noreferrer">{doi}</a>} />
              <FieldRow label="PMID" value={getStr("_str.pmid", "pmid")} />
              <FieldRow label="ISBN" value={getStr("_str.isbn", "isbn")} />
            </tbody>
          </table>
          <button className="json-btn" onClick={() => setShowJson(true)}>{"{ }"} Show JSON</button>
        </div>
      </div>
    </>
  );
}

export function DoiSearchPage() {
  const [input, setInput]       = React.useState("");
  const [loading, setLoading]   = React.useState(false);
  const [error, setError]       = React.useState("");
  const [projects, setProjects] = React.useState<FWFProject[]>([]);
  const [outputs, setOutputs]   = React.useState<FWFOutput[]>([]);
  const [searched, setSearched] = React.useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const doi = input.trim();
    if (!doi) return;
    setLoading(true); setError(""); setSearched(false);
    try {
      const res = await searchByDoi(doi);
      setProjects(res.projects); setOutputs(res.outputs); setSearched(true);
    } catch (e: any) { setError(e.message || "Search failed"); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">DOI / Identifier Search</div>
        <p className="page-subtitle">Look up FWF projects and outputs by DOI, Grant DOI, ORCID, or any identifier</p>
      </div>

      <div className="ql-search-bar" style={{ marginBottom: 16 }}>
        <form onSubmit={handleSearch}>
          <div className="ql-search-controls">
            <input
              className="ql-search-input"
              placeholder="e.g. 10.55776/P12345 · DOC32 · ORCID · researcher name"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button type="submit" className="ql-btn-search" disabled={loading || !input.trim()}>
              {loading ? "Searching…" : "Search"}
            </button>
            {searched && <button type="button" className="ql-btn-reset" onClick={() => { setInput(""); setProjects([]); setOutputs([]); setSearched(false); }}>Reset</button>}
          </div>
        </form>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
          Search is full-text across all FWF fields — use grant numbers, DOIs, researcher names, or keywords.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {searched && !loading && (
        <>
          {(projects.length + outputs.length) === 0 && (
            <div className="empty-state">No results found for "{input}".</div>
          )}
          {projects.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: 10 }}>
                Projects ({projects.length})
              </div>
              {projects.map(p => <ProjectResult key={p.id} p={p} />)}
            </div>
          )}
          {outputs.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: 10 }}>
                Outputs ({outputs.length})
              </div>
              {outputs.map(o => <OutputResult key={String(o.id)} o={o} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
