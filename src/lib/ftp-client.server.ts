// Minimal FTP client built on Cloudflare's raw TCP sockets API. Hostinger's
// "Single Web Hosting" plan has no REST upload endpoint (verified against
// their public OpenAPI spec), so this is the only programmatic path to get
// video files onto the server that backs videos.travancoreayurvedalearning.com.
import { connect } from "cloudflare:sockets";

export type FtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
};

type FtpReply = { code: number; message: string };

class FtpControlChannel {
  private socket: ReturnType<typeof connect>;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private buffer = "";
  private readonly decoder = new TextDecoder();
  private readonly encoder = new TextEncoder();

  constructor(socket: ReturnType<typeof connect>) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }

  private async fillBuffer(): Promise<boolean> {
    const { value, done } = await this.reader.read();
    if (done) return false;
    this.buffer += this.decoder.decode(value, { stream: true });
    return true;
  }

  // FTP replies are one or more CRLF-terminated lines. A multi-line reply's
  // first line is "CODE-text" (dash); it ends at a line starting "CODE text".
  async readReply(): Promise<FtpReply> {
    let code: number | null = null;
    while (true) {
      const lineEnd = this.buffer.indexOf("\r\n");
      if (lineEnd === -1) {
        if (!(await this.fillBuffer())) {
          throw new Error("FTP control connection closed unexpectedly");
        }
        continue;
      }
      const line = this.buffer.slice(0, lineEnd);
      this.buffer = this.buffer.slice(lineEnd + 2);

      const match = line.match(/^(\d{3})([ -])/);
      if (!match) continue;
      const lineCode = Number(match[1]);
      if (code === null) {
        code = lineCode;
        if (match[2] === " ") return { code, message: line.slice(4) };
        // multi-line: keep reading until "CODE " (space) with the same code
      } else if (match[2] === " " && lineCode === code) {
        return { code, message: line.slice(4) };
      }
    }
  }

  async sendCommand(cmd: string): Promise<FtpReply> {
    await this.writer.write(this.encoder.encode(cmd + "\r\n"));
    return this.readReply();
  }

  async close() {
    try {
      await this.writer.close();
    } catch {
      // already closed
    }
  }
}

function assertOk(reply: FtpReply, context: string) {
  if (reply.code >= 400) {
    throw new Error(`FTP ${context} failed: ${reply.code} ${reply.message}`);
  }
}

function parsePasv(message: string): { host: string; port: number } {
  const match = message.match(/(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/);
  if (!match) throw new Error(`Could not parse PASV reply: ${message}`);
  const [, a, b, c, d, p1, p2] = match.map(Number);
  return { host: `${a}.${b}.${c}.${d}`, port: p1 * 256 + p2 };
}

// Cloudflare's Workers TCP Sockets occasionally fail to establish the very
// first connection to a given origin ("proxy request failed, cannot connect
// to the specified address") — transient, and only ever observed here before
// login completes, never mid-transfer. Retrying just the connect+login phase
// (before the request body is ever touched) makes this reliable in practice.
async function connectAndLogin(
  config: FtpConfig,
): Promise<{ socket: ReturnType<typeof connect>; ctrl: FtpControlChannel }> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const socket = connect({ hostname: config.host, port: config.port });
    const ctrl = new FtpControlChannel(socket);
    try {
      await socket.opened;
      assertOk(await ctrl.readReply(), "connect");
      assertOk(await ctrl.sendCommand(`USER ${config.user}`), "USER");
      assertOk(await ctrl.sendCommand(`PASS ${config.password}`), "PASS");
      assertOk(await ctrl.sendCommand("TYPE I"), "TYPE I");
      return { socket, ctrl };
    } catch (err) {
      lastErr = err;
      try {
        await socket.close();
      } catch {
        // already closed
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
  }
  throw new Error(`FTP connect/login failed after ${MAX_ATTEMPTS} attempts: ${String(lastErr)}`);
}

async function withControlChannel<T>(
  config: FtpConfig,
  fn: (ctrl: FtpControlChannel) => Promise<T>,
): Promise<T> {
  const { socket, ctrl } = await connectAndLogin(config);
  try {
    return await fn(ctrl);
  } finally {
    try {
      await ctrl.sendCommand("QUIT");
    } catch {
      // best effort
    }
    await ctrl.close();
    try {
      await socket.close();
    } catch {
      // already closed
    }
  }
}

async function openPassiveDataSocket(ctrl: FtpControlChannel, config: FtpConfig) {
  const pasvReply = await ctrl.sendCommand("PASV");
  assertOk(pasvReply, "PASV");
  const { host, port } = parsePasv(pasvReply.message);
  // Hostinger's PASV reply sometimes reports an internal IP; the control
  // channel's own host is always reachable and correct for the data channel too.
  return connect({ hostname: host || config.host, port });
}

export async function ftpUploadFile(
  config: FtpConfig,
  remotePath: string,
  body: ReadableStream<Uint8Array>,
): Promise<void> {
  await withControlChannel(config, async (ctrl) => {
    const dataSocket = await openPassiveDataSocket(ctrl, config);
    try {
      await dataSocket.opened;
    } catch (err) {
      throw new Error(`FTP data socket failed to open: ${String(err)}`);
    }

    const storReply = await ctrl.sendCommand(`STOR ${remotePath}`);
    if (storReply.code >= 400) {
      try {
        await dataSocket.close();
      } catch {
        // ignore
      }
      throw new Error(`FTP STOR failed: ${storReply.code} ${storReply.message}`);
    }

    try {
      await body.pipeTo(dataSocket.writable);
    } catch (err) {
      throw new Error(`FTP data transfer failed: ${String(err)}`);
    }
    const finalReply = await ctrl.readReply();
    assertOk(finalReply, "STOR completion");
  });
}

export async function ftpDelete(config: FtpConfig, remotePath: string): Promise<void> {
  await withControlChannel(config, async (ctrl) => {
    assertOk(await ctrl.sendCommand(`DELE ${remotePath}`), "DELE");
  });
}

export async function ftpList(config: FtpConfig, dir: string): Promise<string> {
  return withControlChannel(config, async (ctrl) => {
    const dataSocket = await openPassiveDataSocket(ctrl, config);
    const listReply = await ctrl.sendCommand(`LIST ${dir}`);
    if (listReply.code >= 400) {
      try {
        await dataSocket.close();
      } catch {
        // ignore
      }
      throw new Error(`FTP LIST failed: ${listReply.code} ${listReply.message}`);
    }

    const chunks: Uint8Array[] = [];
    const reader = dataSocket.readable.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    await ctrl.readReply();

    const total = chunks.reduce((n, c) => n + c.length, 0);
    const combined = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      combined.set(c, offset);
      offset += c.length;
    }
    return new TextDecoder().decode(combined);
  });
}
