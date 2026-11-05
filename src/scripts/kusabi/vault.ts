// Spoiler data lives in separate JSON files under /kusabi/vault/ and is fetched
// only after the matching unlock, so it is neither in the page source nor in the
// network log of a reader who has not reached it. This is a reading game, not
// security: the files are public to anyone who goes looking.
import { withBase } from "../../utils/base-path";

const cache = new Map<string, Promise<unknown>>();

export function loadVault<T>(file: string): Promise<T> {
  let request = cache.get(file);
  if (!request) {
    request = fetch(withBase(`/kusabi/vault/${file}.json`)).then((response) => {
      if (!response.ok) throw new Error(`vault ${file}: ${response.status}`);
      return response.json();
    });
    request.catch(() => cache.delete(file));
    cache.set(file, request);
  }
  return request as Promise<T>;
}
