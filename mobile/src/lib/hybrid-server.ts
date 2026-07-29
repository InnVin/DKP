const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

function isPrivateHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.endsWith(".local") ||
    PRIVATE_IPV4_PATTERNS.some(pattern => pattern.test(normalized))
  );
}

export function normalizeHybridServerUrl(input: string) {
  const value = input.trim();
  if (!value) throw new Error("Введите адрес веб-приложения.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Введите полный адрес, например https://app.example.ru.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Поддерживаются только адреса HTTP и HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("Логин и пароль нельзя передавать внутри адреса.");
  }
  if (url.protocol === "http:" && !isPrivateHost(url.hostname)) {
    throw new Error("Для внешнего сервера обязательно используйте HTTPS.");
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString().replace(/\/$/, "");
}

export function isTrustedHybridNavigation(target: string, serverUrl: string) {
  if (target === "about:blank") return true;
  try {
    return new URL(target).origin === new URL(serverUrl).origin;
  } catch {
    return false;
  }
}
