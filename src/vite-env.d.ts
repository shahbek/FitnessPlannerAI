/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GROQ_API_KEY: string
  readonly VITE_OPENAI_API_KEY?: string
  readonly VITE_CUSTOM_API_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
