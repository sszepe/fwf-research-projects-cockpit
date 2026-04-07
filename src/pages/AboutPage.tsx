import React from "react";
import { ORG_ROR, ORG_NAME, getIndexStats } from "../api/fwf";

const API_BASE = import.meta.env.VITE_FWF_API_BASE || "https://openapi.fwf.ac.at";

export function AboutPage() {
  const [stats, setStats] = React.useState<Record<string, any>>({});

  React.useEffect(() => { getIndexStats().then(setStats).catch(() => {}); }, []);

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="page-header">
        <div className="page-title">About</div>
        <p className="page-subtitle">Configuration and API information</p>
      </div>

      <div className="ql-results-panel" style={{ marginBottom: 14 }}>
        <div className="ql-results-header"><span className="ql-results-title">Institution</span></div>
        <div style={{ padding: "4px 0" }}>
          <table className="field-table">
            <tbody>
              <tr><td>Name</td><td>{ORG_NAME}</td></tr>
              <tr><td>ROR ID</td><td><a className="mono-link" href={ORG_ROR} target="_blank" rel="noopener noreferrer">{ORG_ROR}</a></td></tr>
              <tr><td>Data Source</td><td><a className="mono-link" href={API_BASE} target="_blank" rel="noopener noreferrer">{API_BASE}</a></td></tr>
              <tr><td>License</td><td>CC0 – Public Domain (FWF Open Data)</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {Object.keys(stats).length > 0 && (
        <div className="ql-results-panel" style={{ marginBottom: 14 }}>
          <div className="ql-results-header"><span className="ql-results-title">API Index Status</span></div>
          <div style={{ padding: "4px 0" }}>
            <table className="field-table">
              <tbody>
                {Object.entries(stats).map(([uid, info]) => (
                  <tr key={uid}>
                    <td>{uid}</td>
                    <td>{(info as any).numberOfDocuments?.toLocaleString()} documents · updated {(info as any).updatedAt ? new Date((info as any).updatedAt).toLocaleDateString("en-GB") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="ql-results-panel">
        <div className="ql-results-header"><span className="ql-results-title">Configuration (.env.local)</span></div>
        <div style={{ padding: "12px 14px" }}>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
            To deploy for a different institution, update <code style={{ background: "#f3f4f6", padding: "1px 5px", borderRadius: 3, fontSize: 12 }}>.env.local</code>:
          </p>
          <pre style={{ background: "#0f1f33", color: "#7dd3fc", padding: "14px 16px", borderRadius: 8, fontSize: 12, fontFamily: "ui-monospace, monospace", lineHeight: 1.7, overflowX: "auto" }}>
{`VITE_ORG_ROR=https://ror.org/YOUR_ROR_ID
VITE_ORG_NAME=Your University Name

VITE_FWF_API_BASE=https://openapi.fwf.ac.at
VITE_FWF_API_KEY=3a03f2f39cc8a99ea0775270adb4946c425469aa7f291e7ca9f2d8424337c1af`}
          </pre>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
            Find your institution's ROR at <a href="https://ror.org" target="_blank" rel="noopener noreferrer">ror.org</a>.
            The API key is public and does not require registration.
          </p>
        </div>
      </div>
    </div>
  );
}
