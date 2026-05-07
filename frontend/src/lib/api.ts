/**
 * Tiny API helper for the frontend. Vite proxies `/api` to the
 * coordinator in dev; production sets the base via VITE_API_BASE.
 * Relative paths everywhere mean uploaded GLBs serve from the same
 * origin without CORS dance.
 */

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export interface AvatarUploadResult {
  filename: string;
  url: string;
  size: number;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function uploadAvatar(file: File, token: string | null): Promise<AvatarUploadResult> {
  if (!token) {
    throw new ApiError(401, "wallet must be connected to upload avatars");
  }
  const form = new FormData();
  form.append("file", file);

  const resp = await fetch(`${API_BASE}/api/v1/avatars/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!resp.ok) {
    let detail = `${resp.status} ${resp.statusText}`;
    try {
      const body = (await resp.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {}
    throw new ApiError(resp.status, detail);
  }

  return (await resp.json()) as AvatarUploadResult;
}

export function avatarUrl(relativePath: string): string {
  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    return relativePath;
  }
  return `${API_BASE}${relativePath}`;
}
