export const ACCOUNT_BLOCKED_FLAG = 'accountBlocked';

export function isAccountBlockedResponse(status: number | undefined, data: unknown): boolean {
  if (status !== 403 || data == null) return false;
  if (typeof data === 'object' && data !== null) {
    const d = data as { code?: string; error?: string; message?: string };
    if (d.code === 'account_blocked') return true;
    const text = (d.error || d.message || '').toLowerCase();
    return text.includes('заблокирован');
  }
  if (typeof data === 'string') return data.toLowerCase().includes('заблокирован');
  return false;
}

export function forceLogoutBlocked(): void {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  sessionStorage.setItem(ACCOUNT_BLOCKED_FLAG, 'true');
  window.location.href = '/login';
}
