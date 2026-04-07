import { ORG_NAME } from "../api/fwf";

export function Footer() {
  return (
      <footer className="app-footer">
        <span>{new Date().getFullYear()}</span>
        <span>{ORG_NAME}</span>
      </footer>
    );
}