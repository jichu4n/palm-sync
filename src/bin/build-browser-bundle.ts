import browserify from 'browserify';
import tsify from 'tsify';
import path from 'path';

export function buildBrowserBundle() {
  const b = browserify('./src/index-browser.ts', {
    basedir: path.join(__dirname, '..', '..'),
    debug: true,
    fullPaths: true,
    plugin: [
      [
        tsify,
        {
          // Needed on macOS to prevent an error saying "Already included file
          // name XXX differs from file name XXX only in casing"
          forceConsistentCasingInFileNames: false,
        },
      ],
    ],
    browserField: 'browserify',
    standalone: 'palm-sync',
  });
  b.bundle().pipe(process.stdout);
}

if (require.main === module) {
  buildBrowserBundle();
}
