import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/config/env";
import type {
  HeadResult,
  SignUploadInput,
  SignUploadResult,
  StorageAdapter,
} from "@/lib/storage/types";

function localHost(endpoint: string) {
  try {
    const host = new URL(endpoint).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function isLocalStorage() {
  return localHost(env.STORAGE_ENDPOINT);
}

function localRoot() {
  return join(process.cwd(), ".local-storage");
}

function localPath(objectKey: string) {
  return join(localRoot(), ...objectKey.split("/").filter((p) => p && p !== ".."));
}

function metaPath(objectKey: string) {
  return `${localPath(objectKey)}.meta`;
}

function toWeb(stream: Readable) {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

export class R2StorageAdapter implements StorageAdapter {
  private readonly local = isLocalStorage();
  private readonly client = this.local
    ? null
    : new S3Client({
        region: env.STORAGE_REGION,
        endpoint: env.STORAGE_ENDPOINT,
        credentials: {
          accessKeyId: env.STORAGE_ACCESS_KEY_ID,
          secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
      });

  async signUpload(input: SignUploadInput): Promise<SignUploadResult> {
    const headers = {
      "Content-Type": input.contentType,
      "Content-Length": String(input.contentLength),
    };
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    if (this.local) {
      return { url: "", headers, expiresAt };
    }
    const url = await getSignedUrl(
      this.client!,
      new PutObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: input.objectKey,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      }),
      { expiresIn: 300 },
    );
    return { url, headers, expiresAt };
  }

  async put(objectKey: string, body: Uint8Array, contentType: string) {
    if (this.local) {
      const path = localPath(objectKey);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
      await writeFile(metaPath(objectKey), contentType, "utf8");
      return;
    }
    await this.client!.send(
      new PutObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        ContentLength: body.byteLength,
      }),
    );
  }

  async head(objectKey: string): Promise<HeadResult> {
    if (this.local) {
      try {
        const info = await stat(localPath(objectKey));
        const contentType = await readFile(metaPath(objectKey), "utf8").catch(
          () => "application/octet-stream",
        );
        return { exists: true, contentLength: info.size, contentType };
      } catch {
        return { exists: false, contentLength: 0, contentType: "" };
      }
    }
    try {
      const out = await this.client!.send(
        new HeadObjectCommand({
          Bucket: env.STORAGE_BUCKET,
          Key: objectKey,
        }),
      );
      return {
        exists: true,
        contentLength: out.ContentLength ?? 0,
        contentType: out.ContentType ?? "",
      };
    } catch {
      return { exists: false, contentLength: 0, contentType: "" };
    }
  }

  async get(objectKey: string): Promise<ReadableStream<Uint8Array>> {
    if (this.local) {
      return toWeb(createReadStream(localPath(objectKey)));
    }
    const out = await this.client!.send(
      new GetObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: objectKey,
      }),
    );
    if (!out.Body) throw new Error("empty object");
    return toWeb(out.Body as Readable);
  }

  async delete(objectKey: string) {
    if (this.local) {
      await unlink(localPath(objectKey)).catch(() => undefined);
      await unlink(metaPath(objectKey)).catch(() => undefined);
      return;
    }
    await this.client!.send(
      new DeleteObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: objectKey,
      }),
    );
  }
}
