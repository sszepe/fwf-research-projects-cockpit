/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORG_ROR: string;
  readonly VITE_ORG_NAME: string;
  readonly VITE_FWF_API_BASE: string;
  readonly VITE_FWF_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
