/** Убирает английский техтекст axios/HttpClient при недоступном устройстве. */
export function deviceErrorMsg(err: unknown, fallback = 'Ошибка при выполнении команды'): string {
  const ax = err as { response?: { data?: { detail?: string; message?: string } | string }; message?: string };
  const data = ax.response?.data;
  let raw = '';
  if (typeof data === 'string') raw = data;
  else if (data && typeof data === 'object') raw = data.detail || data.message || '';
  if (!raw) raw = ax.message || '';
  return humanize(raw) || fallback;
}

function humanize(text: string): string {
  const l = text.toLowerCase();
  if (
    l.includes('cancel') ||
    l.includes('elapsing') ||
    l.includes('httpclient.timeout') ||
    l.includes('8 second') ||
    l.includes('timed out') ||
    l.includes('timeout')
  ) {
    return 'Устройство недоступно или не отвечает. Проверьте состояние устройства.';
  }
  return text.trim();
}
