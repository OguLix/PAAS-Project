import type { Response } from 'express';

export function readCookie(requestCookie: string | undefined, cookieName: string): string | null {
  if (!requestCookie) {
    return null;
  }

  const prefix = `${cookieName}=`;
  for (const item of requestCookie.split(';')) {
    const cookie = item.trim();
    if (cookie.startsWith(prefix)) {
      const value = cookie.slice(prefix.length);
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
    }
  }

  return null;
}

export function setSessionCookie(
  response: Response,
  cookieName: string,
  token: string,
  maxAgeSeconds: number,
): void {
  response.append(
    'Set-Cookie',
    `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`,
  );
}

export function clearSessionCookie(response: Response, cookieName: string): void {
  response.append(
    'Set-Cookie',
    `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  );
}
