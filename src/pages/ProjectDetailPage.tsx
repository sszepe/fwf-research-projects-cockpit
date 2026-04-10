import React from "react";
import {
  fetchProjectById,
  fetchOutputsByProjectId,
  fetchFurtherFundingByProjectId,
  furtherFundingTitle,
  formatAmount,
  formatDate,
  type FWFOutput,
  type FWFProject,
  type FWFFurtherFunding,
} from "../api/fwf";
import { hrefFor, outputPath, personPath, personSlug, furtherFundingPath } from "../router";

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const [project, setProject] = React.useState<FWFProject | null>(null);
  const [outputs, setOutputs] = React.useState<FWFOutput[]>([]);
  const [furtherFundings, setFurtherFundings] = React.useState<FWFFurtherFunding[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchProjectById(projectId),
      fetchOutputsByProjectId(projectId),
      fetchFurtherFundingByProjectId(projectId),
    ])
      .then(([p, outs, ff]) => { setProject(p); setOutputs(outs); setFurtherFundings(ff); })
      .catch((e: any) => setError(e?.message || "Failed to load project"))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div className="app-loading"><div className="spinner" /><span>Loading project…</span></div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!project) return <div className="empty-state">Project not found.</div>;

  const title = project["_str.projecttitle.en"] || project["_str.projecttitle.de"] || project.id;
  const pi = [project["_str.principalinvestigator.firstname"], project["_str.principalinvestigator.lastname"]].filter(Boolean).join(" ");
  const institute = project["_str.principalinvestigator.researchinstitute.name"] || "";
  const piSlug = pi ? personSlug(pi, institute, project["_str.principalinvestigator.orcid"] || "") : "";

  return (
    <div>
      <div className="page-header"><div className="page-title">{title}</div><p className="page-subtitle">Project detail</p></div>
      <div className="ql-results-panel" style={{ marginBottom: 16 }}><div className="ql-results-header"><span className="ql-results-title">Project metadata</span></div><div style={{ padding: "12px 14px" }}>
        <table className="field-table"><tbody>
          <tr><td>ID</td><td>{project.id}</td></tr>
          <tr><td>Status</td><td>{project["_str.status.en"] || project["_str.status.de"] || "—"}</td></tr>
          <tr><td>PI</td><td>{pi ? <a className="router-link" href={hrefFor(personPath(piSlug))}>{pi}</a> : "—"}</td></tr>
          <tr><td>Institution</td><td>{institute || "—"}</td></tr>
          <tr><td>Programme</td><td>{project["_str.program.en"] || project["_str.program.de"] || "—"}</td></tr>
          <tr><td>Approved Amount</td><td>{formatAmount(project["_long.approvedamount"] || undefined) || "—"}</td></tr>
          <tr><td>Start</td><td>{formatDate(project["_date.startdate"] || undefined) || "—"}</td></tr>
          <tr><td>End</td><td>{formatDate(project["_date.enddate"] || undefined) || "—"}</td></tr>
          <tr><td>Grant DOI</td><td>{project["_str.grantdoi"] ? <a className="mono-link" href={`https://doi.org/${String(project["_str.grantdoi"]).replace(/^https?:\/\/doi\.org\//, "")}`} target="_blank" rel="noopener noreferrer">{String(project["_str.grantdoi"])}</a> : "—"}</td></tr>
          <tr><td>Research Radar</td><td>{project["_str.url"] ? <a className="mono-link" href={String(project["_str.url"])} target="_blank" rel="noopener noreferrer">{String(project["_str.url"])}</a> : "—"}</td></tr>
        </tbody></table>
        {(project["_str.prproposalsummary.en"] || project["_str.prproposalsummary.de"]) && <div style={{ marginTop: 12 }}><div className="detail-label">Summary</div><p style={{ color: "var(--muted)" }}>{project["_str.prproposalsummary.en"] || project["_str.prproposalsummary.de"]}</p></div>}
      </div></div>

      <div className="ql-results-panel" style={{ marginBottom: 16 }}>
        <div className="ql-results-header">
          <span className="ql-results-title">Further Funding</span>
          <span className="ql-results-count">{furtherFundings.length}</span>
        </div>
        {furtherFundings.length === 0 ? (
          <div className="empty-state">No further funding records found.</div>
        ) : (
          <div style={{ padding: "12px 14px" }}>
            {furtherFundings.map(ff => (
              <div key={ff.id} className="detail-list-item">
                <a className="router-link" href={hrefFor(furtherFundingPath(ff.id))}>
                  {furtherFundingTitle(ff)}
                </a>
                <div className="detail-submeta">
                  {[
                    ff["_str.funderabbreviation"] || ff["_str.funder"],
                    ff["_str.grantnumber"],
                    typeof ff["_long.approvedamount"] === "number"
                      ? formatAmount(ff["_long.approvedamount"], ff["_str.currency"] || "EUR")
                      : null,
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ql-results-panel"><div className="ql-results-header"><span className="ql-results-title">Related Outputs</span><span className="ql-results-count">{outputs.length}</span></div>{outputs.length === 0 ? <div className="empty-state">No related outputs found.</div> : <div style={{ padding: "12px 14px" }}>{outputs.map(out => <div key={out.id} className="detail-list-item"><a className="router-link" href={hrefFor(outputPath(String(out.id)))}>{String(out["_str.title"] || "Untitled Output")}</a><div className="detail-submeta">{String(out["_str.category"] || "")}{out["_str.year"] ? ` · ${String(out["_str.year"])}` : ""}</div></div>)}</div>}</div>
    </div>
  );
}
