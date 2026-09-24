import { statSync } from 'node:fs';
import { defineConfig } from 'vite';

const SIZED_QUERY = '?sized';

const sizedUrl = () => ({
  name: 'sized-url',
  enforce: 'pre',
  load(id) {
    if (!id.endsWith(SIZED_QUERY)) return null;
    const file = id.slice(0, -SIZED_QUERY.length);
    return `import url from ${JSON.stringify(`${file}?url`)};\nexport default { url, bytes: ${statSync(file).size} };`;
  },
});

export default defineConfig({
  plugins: [sizedUrl()],
});
