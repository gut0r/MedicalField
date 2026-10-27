import { packager } from '@electron/packager';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(currentDir, '..');
const releaseDir = path.join(desktopRoot, 'release');

await fs.promises.rm(releaseDir, { recursive: true, force: true });
const applicationPaths = await packager({
  dir: desktopRoot,
  out: releaseDir,
  overwrite: true,
  platform: 'win32',
  arch: 'x64',
  name: 'MedicalField Socorrista',
  executableName: 'MedicalField-Socorrista',
  appVersion: '0.1.0',
  prune: true,
  ignore: [/^\/release($|\/)/, /^\/test($|\/)/],
});

console.log(`Aplicativo gerado em ${applicationPaths.join(', ')}`);
