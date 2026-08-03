declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}

interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success?: boolean;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

interface R2ObjectBody {
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface R2Bucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | Blob,
    options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string | string[]): Promise<void>;
}

interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}
