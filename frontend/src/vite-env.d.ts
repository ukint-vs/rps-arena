/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROGRAM_ID?: string;
  readonly VITE_NODE_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.idl?raw" {
  const content: string;
  export default content;
}
