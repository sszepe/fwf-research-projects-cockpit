import React from "react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ProjectsPage } from "./pages/ProjectsPage";
import { OutputsPage } from "./pages/OutputsPage";
import { DoiSearchPage } from "./pages/DoiSearchPage";
import { AboutPage } from "./pages/AboutPage";
import { PersonPage } from "./pages/PersonPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { OutputDetailPage } from "./pages/OutputDetailPage";
import { PersonDetailPage } from "./pages/PersonDetailPage";
import { hrefFor, useHashLocation } from "./router";

const TABS = [
  { key: "/projects", label: "Projects" },
  { key: "/outputs", label: "Outputs" },
  { key: "/persons", label: "Persons" },
  { key: "/doi", label: "DOI / ID Search" },
  { key: "/about", label: "About" },
] as const;

function isActive(path: string, key: string) {
  return path === key || path.startsWith(`${key}/`);
}

export default function App() {
  const path = useHashLocation();
  const segments = path.split("/").filter(Boolean);
  const section = segments[0] || "projects";
  const itemId = segments[1] || "";

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <nav className="multilevel-nav">
          <div className="nav-top">
            <div className="nav-top-items">
              {TABS.map(t => (
                <a key={t.key} href={hrefFor(t.key)} className={`nav-top-tab${isActive(path, t.key) ? " nav-top-tab--active" : ""}`}>
                  {t.label}
                </a>
              ))}
            </div>
          </div>
        </nav>

        {section === "projects" && !itemId && <ProjectsPage />}
        {section === "projects" && !!itemId && <ProjectDetailPage projectId={itemId} />}

        {section === "outputs" && !itemId && <OutputsPage />}
        {section === "outputs" && !!itemId && <OutputDetailPage outputId={itemId} />}

        {section === "persons" && !itemId && <PersonPage />}
        {section === "persons" && !!itemId && <PersonDetailPage slug={itemId} />}

        {section === "doi" && <DoiSearchPage />}
        {section === "about" && <AboutPage />}
      </main>
      <Footer />
    </div>
  );
}
