/**
 * Short-lived in-memory record of who minted each presigned upload URL.
 * Entries expire after 10 minutes — enough time for an upload to complete.
 */
const pendingUploads = new Map<string, { userId: string; expiresAt: number }>();

export function registerUpload(objectPath: string, userId: string): void {
  const expiresAt = Date.now() + 10 * 60 * 1000;
  pendingUploads.set(objectPath, { userId, expiresAt });
  // Evict stale entries opportunistically on each new upload
  const now = Date.now();
  for (const [k, v] of pendingUploads) {
    if (v.expiresAt < now) pendingUploads.delete(k);
  }
}

export function wasUploadedBy(objectPath: string, userId: string): boolean {
  const entry = pendingUploads.get(objectPath);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    pendingUploads.delete(objectPath);
    return false;
  }
  return entry.userId === userId;
}
