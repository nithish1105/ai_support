/**
 * JWT Token validation helper.
 * Validates format and checks if the token has expired.
 */
export function isTokenValid(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  
  const parts = token.trim().split('.');
  if (parts.length !== 3) return false;

  try {
    // Base64URL decode
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);

    // If there is an expiration claim, verify it with a 10s leeway
    if (payload.exp && typeof payload.exp === 'number') {
      const currentTimeSeconds = Math.floor(Date.now() / 1000);
      if (currentTimeSeconds >= payload.exp - 10) {
        return false; // Expired
      }
    }

    return true;
  } catch {
    return false;
  }
}
