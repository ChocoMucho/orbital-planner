declare module "cloudflare:workers" {
  export const env: { readonly DB?: D1Database };
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface D1Database {
  readonly __d1DatabaseBrand?: unique symbol;
}
