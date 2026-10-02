const TOKEN_KEY = 'financeadvisor.token';
const TOKEN_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const isBrowser = () => typeof window !== 'undefined';

const writeTokenCookie = (token: string): void => {
  if (!isBrowser()) return;

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=${TOKEN_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
};

const clearTokenCookie = (): void => {
  if (!isBrowser()) return;
  document.cookie = `${TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
};

export const getToken = (): string | null => {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  if (!isBrowser()) return;
  window.localStorage.setItem(TOKEN_KEY, token);
  writeTokenCookie(token);
};

export const clearToken = (): void => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TOKEN_KEY);
  clearTokenCookie();
};
