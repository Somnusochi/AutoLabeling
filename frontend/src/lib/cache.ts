export const batchFileMap = new Map<string, File>();

export const fileUrlCache = new WeakMap<File, string>();

export function getFileUrl(file: File): string {
  if (!fileUrlCache.has(file)) {
    fileUrlCache.set(file, URL.createObjectURL(file));
  }
  return fileUrlCache.get(file)!;
}
