import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface RepositoryAdapter {
  put(input: { requestId: string; category: string; originalFilename: string; bytes: Uint8Array; expectedHash?: string }): Promise<{ storageKey: string; repositoryRef: string; sha256: string }>;
  get(storageKey: string): Promise<Uint8Array>;
  health(): Promise<{ ok: boolean; message: string }>;
}

function safeSegment(value: string) { return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100); }

export class LocalRepositoryAdapter implements RepositoryAdapter {
  constructor(private root = process.env.LOCAL_STORAGE_ROOT ?? path.join(process.cwd(), "storage")) {}
  async put(input: { requestId: string; category: string; originalFilename: string; bytes: Uint8Array; expectedHash?: string }) {
    const sha256 = createHash("sha256").update(input.bytes).digest("hex");
    if (input.expectedHash && input.expectedHash !== sha256) throw new Error("Repository integrity check failed");
    const storageKey = `${safeSegment(input.requestId)}/${safeSegment(input.category)}/${randomUUID()}-${safeSegment(input.originalFilename)}`;
    const destination = path.resolve(this.root, storageKey);
    const resolvedRoot = path.resolve(this.root) + path.sep;
    if (!destination.startsWith(resolvedRoot)) throw new Error("Unsafe repository path");
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, input.bytes, { flag: "wx" });
    return { storageKey, repositoryRef: `local:${storageKey}`, sha256 };
  }
  async get(storageKey: string) {
    const destination = path.resolve(this.root, storageKey);
    if (!destination.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Unsafe repository path");
    return readFile(destination);
  }
  async health() { try { await mkdir(this.root, { recursive: true }); return { ok: true, message: "Local repository available" }; } catch { return { ok: false, message: "Local repository unavailable" }; } }
}

export class S3RepositoryAdapter implements RepositoryAdapter {
  async put(): Promise<never> { throw new Error("S3 credentials/client are not configured"); }
  async get(): Promise<never> { throw new Error("S3 credentials/client are not configured"); }
  async health() { return { ok: false, message: "Configure S3 endpoint, bucket and credentials" }; }
}

export class GfsRepositoryAdapter implements RepositoryAdapter {
  async put(): Promise<never> { throw new Error("GFS endpoint protocol is not configured"); }
  async get(): Promise<never> { throw new Error("GFS endpoint protocol is not configured"); }
  async health() { return { ok: false, message: "Configure the GFS protocol adapter" }; }
}
