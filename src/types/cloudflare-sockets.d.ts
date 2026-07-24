// Minimal ambient declaration for the subset of Cloudflare's raw TCP sockets
// API used by ftp-client.server.ts. Deliberately not pulling in the full
// `wrangler types` output here — it redeclares DOM globals (addEventListener,
// etc.) in ways that conflict with the browser-side code in this same project.
declare module "cloudflare:sockets" {
  export interface Socket {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<Uint8Array>;
    readonly opened: Promise<void>;
    readonly closed: Promise<void>;
    close(): Promise<void>;
  }

  export interface SocketOptions {
    secureTransport?: "off" | "on" | "starttls";
    allowHalfOpen?: boolean;
  }

  export function connect(
    address: string | { hostname: string; port: number },
    options?: SocketOptions,
  ): Socket;
}
