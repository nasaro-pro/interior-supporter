import { R2StorageAdapter } from "@/lib/storage/r2";
import type { StorageAdapter } from "@/lib/storage/types";

export type { StorageAdapter } from "@/lib/storage/types";
export { isLocalStorage } from "@/lib/storage/r2";

/** 어댑터는 S3 클라이언트를 들고 있다. 호출마다 새로 만들면 커넥션이 낭비된다. */
let adapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!adapter) adapter = new R2StorageAdapter();
  return adapter;
}
