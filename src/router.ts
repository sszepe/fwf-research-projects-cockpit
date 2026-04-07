import React from "react";

export function getHashPath(): string {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) return "/projects";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function useHashLocation(): string {
  const [path, setPath] = React.useState<string>(getHashPath());

  React.useEffect(() => {
    const onHashChange = () => setPath(getHashPath());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return path;
}

export function hrefFor(path: string): string {
  return `#${path.startsWith("/") ? path : `/${path}`}`;
}

export function projectPath(projectId: string): string {
  return `/projects/${projectId}`;
}

export function outputPath(outputId: string): string {
  return `/outputs/${outputId}`;
}

export function personSlug(name: string, institution = "", orcid = ""): string {
  if (orcid) return `orcid-${orcid.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return `${name} ${institution}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "person";
}

export function personPath(slug: string): string {
  return `/persons/${slug}`;
}
