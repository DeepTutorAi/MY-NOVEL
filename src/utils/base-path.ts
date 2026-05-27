export function withBase(path: string) {
  const basePath = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;

  return `${basePath}${cleanPath}`;
}
