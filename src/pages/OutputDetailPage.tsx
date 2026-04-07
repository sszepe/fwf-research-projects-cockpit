import React from "react";
import { fetchOutputById, fetchProjectsByOutputId, type FWFOutput, type FWFProject } from "../api/fwf";
import { hrefFor, projectPath } from "../router";

export function OutputDetailPage({ outputId }: { outputId: string }) {
  const [output, setOutput] = React.useState<FWFOutput | null>(null);
  const [projects, setProjects] = React.useState<FWFProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    Promise.all([fetchOutputById(outputId), fetchProjectsByOutputId(outputId)])
      .then(([o, ps]) => { setOutput(o); setProjects(ps); })
      .catch((e: any) => setError(e?.message || "Failed to load output"))
      .finally(() => setLoading(false));
  }, [outputId]);

  if (loading) return <div className="app-loading"><div className="spinner" /><span>Loading output…</span></div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!output) return <div className="empty-state">Output not found.</div>;

  const getStr = (...keys: string[]) => { for (const k of keys) { const v = output[k]; if (v && typeof v === "string") return v; } return ""; };
  const title = getStr("_str.title", "title") || "Untitled Output";
  const doi = getStr("_str.doi", "doi");

  return (
    <div>
      <div className="page-header"><div className="page-title">{title}</div><p className="page-subtitle">Output detail</p></div>
      <div className="ql-results-panel" style={{ marginBottom: 16 }}><div className="ql-results-header"><span className="ql-results-title">Output metadata</span></div><div style={{ padding: "12px 14px" }}><table className="field-table"><tbody>
        <tr><td>ID</td><td>{output.id}</td></tr>
        <tr><td>Category</td><td>{getStr("_str.category", "category") || "—"}</td></tr>
        <tr><td>Type</td><td>{getStr("_str.type", "type") || "—"}</td></tr>
        <tr><td>Authors</td><td>{getStr("_str.authors", "authors") || "—"}</td></tr>
        <tr><td>Year</td><td>{getStr("_str.year", "year") || "—"}</td></tr>
        <tr><td>Journal / Publisher</td><td>{getStr("_str.journal", "journal") || getStr("_str.publisher", "publisher") || "—"}</td></tr>
        <tr><td>DOI</td><td>{doi ? <a className="mono-link" href={`https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//, "")}`} target="_blank" rel="noopener noreferrer">{doi}</a> : "—"}</td></tr>
        <tr><td>PMID</td><td>{getStr("_str.pmid", "pmid") || "—"}</td></tr>
        <tr><td>ISBN</td><td>{getStr("_str.isbn", "isbn") || "—"}</td></tr>
        <tr><td>Linkout</td><td>{getStr("_str.linkout", "linkout") ? <a className="mono-link" href={getStr("_str.linkout", "linkout")} target="_blank" rel="noopener noreferrer">Open</a> : "—"}</td></tr>
      </tbody></table></div></div>
      <div className="ql-results-panel"><div className="ql-results-header"><span className="ql-results-title">Related Projects</span><span className="ql-results-count">{projects.length}</span></div>{projects.length === 0 ? <div className="empty-state">No related projects found.</div> : <div style={{ padding: "12px 14px" }}>{projects.map(project => <div key={project.id} className="detail-list-item"><a className="router-link" href={hrefFor(projectPath(project.id))}>{project["_str.projecttitle.en"] || project["_str.projecttitle.de"] || project.id}</a><div className="detail-submeta">{project.id}</div></div>)}</div>}</div>
    </div>
  );
}
