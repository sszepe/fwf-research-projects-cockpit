import React from "react";
import { fetchPersonBySlug, fetchProjectById, fetchOutputById, type FWFOutput, type FWFProject, type PersonRecord } from "../api/fwf";
import { hrefFor, outputPath, projectPath } from "../router";

export function PersonDetailPage({ slug }: { slug: string }) {
  const [person, setPerson] = React.useState<PersonRecord | null>(null);
  const [projects, setProjects] = React.useState<FWFProject[]>([]);
  const [outputs, setOutputs] = React.useState<FWFOutput[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    fetchPersonBySlug(slug)
      .then(async p => {
        setPerson(p);
        if (!p) return;
        const [ps, outs] = await Promise.all([
          Promise.all(p.projectIds.map(id => fetchProjectById(id))).then(items => items.filter(Boolean) as FWFProject[]),
          Promise.all(p.outputIds.map(id => fetchOutputById(id))).then(items => items.filter(Boolean) as FWFOutput[]),
        ]);
        setProjects(ps);
        setOutputs(outs);
      })
      .catch((e: any) => setError(e?.message || "Failed to load person"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="app-loading"><div className="spinner" /><span>Loading person…</span></div>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!person) return <div className="empty-state">Person not found.</div>;

  return (
    <div>
      <div className="page-header"><div className="page-title">{person.name}</div><p className="page-subtitle">Person detail</p></div>
      <div className="ql-results-panel" style={{ marginBottom: 16 }}><div className="ql-results-header"><span className="ql-results-title">Profile</span></div><div style={{ padding: "12px 14px" }}><table className="field-table"><tbody>
        <tr><td>Role</td><td>{person.roles.join(", ")}</td></tr>
        <tr><td>Institution</td><td>{person.institution || "—"}</td></tr>
        <tr><td>ORCID</td><td>{person.orcidLink ? <a className="mono-link" href={person.orcidLink} target="_blank" rel="noopener noreferrer">{person.orcid || person.orcidLink}</a> : (person.orcid || "—")}</td></tr>
        <tr><td>Webpage</td><td>{person.webpage ? <a className="mono-link" href={person.webpage} target="_blank" rel="noopener noreferrer">{person.webpage}</a> : "—"}</td></tr>
      </tbody></table></div></div>
      <div className="detail-two-col">
        <div className="ql-results-panel"><div className="ql-results-header"><span className="ql-results-title">Projects</span><span className="ql-results-count">{projects.length}</span></div>{projects.length === 0 ? <div className="empty-state">No projects found.</div> : <div style={{ padding: "12px 14px" }}>{projects.map(project => <div key={project.id} className="detail-list-item"><a className="router-link" href={hrefFor(projectPath(project.id))}>{project["_str.projecttitle.en"] || project["_str.projecttitle.de"] || project.id}</a><div className="detail-submeta">{project.id}</div></div>)}</div>}</div>
        <div className="ql-results-panel"><div className="ql-results-header"><span className="ql-results-title">Connected Outputs</span><span className="ql-results-count">{outputs.length}</span></div>{outputs.length === 0 ? <div className="empty-state">No outputs found.</div> : <div style={{ padding: "12px 14px" }}>{outputs.map(output => <div key={output.id} className="detail-list-item"><a className="router-link" href={hrefFor(outputPath(String(output.id)))}>{String(output["_str.title"] || output.id)}</a><div className="detail-submeta">{String(output["_str.category"] || "")}</div></div>)}</div>}</div>
      </div>
    </div>
  );
}
