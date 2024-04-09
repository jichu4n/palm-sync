import browserify from 'browserify';
import tsify from 'tsify';
import path from 'path';

export function buildBrowserBundle() {
  const b = browserify('./src/index-browser.ts', {
    basedir: path.join(__dirname, '..', '..'),
    debug: true,
    fullPaths: true,
    plugin: [tsify],
    browserField: 'browserify',
    standalone: 'palm-sync',
  });
  b.bundle().pipe(process.stdout);
}

if (require.main === module) {
  buildBrowserBundle();
}
