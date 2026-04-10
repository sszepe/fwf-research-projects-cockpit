import React from "react";
import {
  fetchFurtherFundingById,
  fetchProjectsByFurtherFundingId,
  furtherFundingTitle,
  formatAmount,
  formatDate,
  type FWFFurtherFunding,
  type FWFProject,
} from "../api/fwf";
import { hrefFor, projectPath } from "../router";

function FieldRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === "" || value === "—") return null;
  return (
    <tr>
      <td>{label}</td>
      <td>{value}</td>
    </tr>
  );
}

export function FurtherFundingDetailPage({ fundingId }: { fundingId: string }) {
  const [funding, setFunding] = React.useState<FWFFurtherFunding | null>(null);
  const [projects, setProjects] = React.useState<FWFProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchFurtherFundingById(fundingId),
      fetchProjectsByFurtherFundingId(fundingId),
    ])
      .then(([f, ps]) => { setFunding(f); setProjects(ps); })
      .catch((e: any) => setError(e?.message || "Failed to load further funding record"))
      .finally(() => setLoading(false));
  }, [fundingId]);

  if (loading) return <div className="app-loading"><div className="spinner" /><span>Loading further funding…</span></div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!funding) return <div className="empty-state">Further funding record not found.</div>;

  const title = furtherFundingTitle(funding);
  const grantDoi = funding["_str.grantdoi"];
  const url = funding["_str.url"];
  const amount = funding["_long.approvedamount"];
  const currency = funding["_str.currency"] || "EUR";

  return (
    <div>
      <div className="page-header">
        <div className="page-title">{title}</div>
        <p className="page-subtitle">Further funding detail</p>
      </div>

      <div className="ql-results-panel" style={{ marginBottom: 16 }}>
        <div className="ql-results-header"><span className="ql-results-title">Funding metadata</span></div>
        <div style={{ padding: "12px 14px" }}>
          <table className="field-table">
            <tbody>
              <FieldRow label="ID" value={funding.id} />
              <FieldRow label="Funder" value={
                funding["_str.funder"]
                  ? `${funding["_str.funder"]}${funding["_str.funderabbreviation"] ? ` (${funding["_str.funderabbreviation"]})` : ""}`
                  : undefined
              } />
              <FieldRow label="Programme" value={funding["_str.programname"]} />
              <FieldRow label="Grant Number" value={funding["_str.grantnumber"]} />
              <FieldRow label="Status" value={funding["_str.status"]} />
              <FieldRow label="Approved Amount" value={typeof amount === "number" ? formatAmount(amount, currency) : undefined} />
              <FieldRow label="Start" value={formatDate(funding["_date.startdate"]) || undefined} />
              <FieldRow label="End" value={formatDate(funding["_date.enddate"]) || undefined} />
              <FieldRow label="Grant DOI" value={
                grantDoi
                  ? <a className="mono-link" href={`https://doi.org/${String(grantDoi).replace(/^https?:\/\/doi\.org\//, "")}`} target="_blank" rel="noopener noreferrer">{String(grantDoi)}</a>
                  : undefined
              } />
              <FieldRow label="URL" value={
                url
                  ? <a className="mono-link" href={String(url)} target="_blank" rel="noopener noreferrer">{String(url)}</a>
                  : undefined
              } />
            </tbody>
          </table>

          {/* Render any extra string fields not explicitly listed above */}
          {(() => {
            const known = new Set([
              "id", "_str.title", "_str.funder", "_str.funderabbreviation",
              "_str.programname", "_str.grantnumber", "_str.grantdoi", "_str.url",
              "_str.status", "_str.currency", "_long.approvedamount",
              "_date.startdate", "_date.enddate", "_list.connected.projects",
            ]);
            const extra = Object.entries(funding).filter(
              ([k, v]) => !known.has(k) && typeof v === "string" && v
            );
            if (extra.length === 0) return null;
            return (
              <table className="field-table" style={{ marginTop: 8 }}>
                <tbody>
                  {extra.map(([k, v]) => (
                    <tr key={k}><td style={{ color: "var(--muted)", fontSize: 12 }}>{k}</td><td>{String(v)}</td></tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>

      <div className="ql-results-panel">
        <div className="ql-results-header">
          <span className="ql-results-title">Related Projects</span>
          <span className="ql-results-count">{projects.length}</span>
        </div>
        {projects.length === 0 ? (
          <div className="empty-state">No related projects found.</div>
        ) : (
          <div style={{ padding: "12px 14px" }}>
            {projects.map(project => (
              <div key={project.id} className="detail-list-item">
                <a className="router-link" href={hrefFor(projectPath(project.id))}>
                  {project["_str.projecttitle.en"] || project["_str.projecttitle.de"] || project.id}
                </a>
                <div className="detail-submeta">{project.id}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
