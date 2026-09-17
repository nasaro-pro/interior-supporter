export type SignUploadInput = {
  objectKey: string;
  contentType: string;
  contentLength: number;
};

export type SignUploadResult = {
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
};

export type HeadResult = {
  contentType: string;
  contentLength: number;
  exists: boolean;
};

export interface StorageAdapter {
  signUpload(input: SignUploadInput): Promise<SignUploadResult>;
  put(
    objectKey: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void>;
  head(objectKey: string): Promise<HeadResult>;
  get(objectKey: string): Promise<ReadableStream<Uint8Array>>;
  delete(objectKey: string): Promise<void>;
}
