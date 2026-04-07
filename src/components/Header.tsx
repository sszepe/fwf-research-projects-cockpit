import { ORG_NAME } from "../api/fwf";

export function Header() {
  return (
    <header className="app-header">
      <div className="header-title">
        <h1>FWF Research Projects Cockpit</h1>
        <div className="header-sub">Austrian Science Fund · Open Data</div>
      </div>
      <div className="header-meta">{ORG_NAME}</div>
    </header>
  );
}
