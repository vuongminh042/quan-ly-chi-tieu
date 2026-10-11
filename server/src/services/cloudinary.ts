import { createHash, randomUUID } from 'node:crypto';

const avatarTransformation = 'c_limit,w_1600,h_1600,q_auto:good,f_jpg';

export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };
export type CloudinaryUploadSignature = Pick<CloudinaryConfig, 'cloudName' | 'apiKey'> & {
  timestamp: number;
  publicId: string;
  transformation: string;
  signature: string;
};

export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== '' && value !== undefined && value !== null)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
}

export function createAvatarUploadSignature(userId: string, config: CloudinaryConfig): CloudinaryUploadSignature {
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `chitieu/avatars/${userId}/${randomUUID()}`;
  const signedParams = {
    overwrite: 'false',
    public_id: publicId,
    timestamp,
    transformation: avatarTransformation,
  };
  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    publicId,
    transformation: avatarTransformation,
    signature: signParams(signedParams, config.apiSecret),
  };
}

export function isUserAvatarPublicId(publicId: string, userId: string): boolean {
  return new RegExp(`^chitieu/avatars/${userId}/[0-9a-f-]{36}$`, 'i').test(publicId);
}

export function isCloudinaryAvatarUrl(urlValue: string, publicId: string, config: CloudinaryConfig): boolean {
  try {
    const url = new URL(urlValue);
    return url.protocol === 'https:'
      && url.hostname === 'res.cloudinary.com'
      && url.pathname.startsWith(`/${config.cloudName}/image/upload/`)
      && url.pathname.endsWith(`/${publicId}.jpg`);
  } catch {
    return false;
  }
}

export async function deleteCloudinaryAvatar(publicId: string, config: CloudinaryConfig): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const invalidate = 'true';
  const signature = signParams({ invalidate, public_id: publicId, timestamp }, config.apiSecret);
  const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), invalidate, api_key: config.apiKey, signature });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const result = await response.json() as { result?: string; error?: { message?: string } };
  if (!response.ok || (result.result !== 'ok' && result.result !== 'not found')) {
    throw new Error(result.error?.message ?? `Cloudinary trả về HTTP ${response.status}.`);
  }
}
