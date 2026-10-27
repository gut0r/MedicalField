import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(currentDir, '..');
const repositoryRoot = path.resolve(desktopRoot, '..', '..');
const fieldClient = path.join(repositoryRoot, 'frontend', 'field-client');
const renderer = path.join(desktopRoot, 'renderer');
const npmCli = process.env.npm_execpath;
const buildCommand = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
const buildArguments = npmCli ? [npmCli, 'run', 'build'] : ['run', 'build'];

await new Promise((resolve, reject) => {
  const child = spawn(buildCommand, buildArguments, {
    cwd: fieldClient,
    env: { ...process.env, VITE_API_BASE_URL: '/api' },
    stdio: 'inherit',
  });
  child.on('error', reject);
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Build do cliente falhou com código ${code}`)));
});

await fs.promises.rm(renderer, { recursive: true, force: true });
await fs.promises.cp(path.join(fieldClient, 'dist'), renderer, { recursive: true });
console.log(`Cliente preparado em ${renderer}`);
