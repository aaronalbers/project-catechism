// A profile imported with `?index` (content/profiles/<id>.json?index) is served with only the fields the lists
// and the feature index show, so each profile's text loads only when it is opened.
// Used by vite.config.ts and vitest.config.ts.
import { readFile } from 'node:fs/promises';

const FIELDS = ['id', 'name', 'role', 'people', 'genealogy'];

export function profileIndex() {
  return {
    name: 'profile-index',
    enforce: 'pre',
    async load(id) {
      const [file, query] = id.split('?');
      if (query !== 'index' || !file.endsWith('.json')) return null;
      this.addWatchFile(file);
      const p = JSON.parse(await readFile(file, 'utf8'));
      return `export default ${JSON.stringify({ ...Object.fromEntries(FIELDS.map((k) => [k, p[k]])), moments: p.moments.map((m) => ({ ref: m.ref })), thumb: p.media?.find((m) => m.type === 'image')?.src })};`;
    },
  };
}
