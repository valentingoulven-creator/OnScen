import { spawn } from 'child_process';
import path from 'path';
import { getAppRoot } from '../paths';

export interface AppBuildResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Lance `npm run build` dans app/ (sortie vers backend/public via vite outDir). */
export function runAppBuild(): Promise<AppBuildResult> {
  const appDir = path.resolve(getAppRoot(), '../app');
  return new Promise((resolve, reject) => {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const proc = spawn('npm', ['run', 'build'], {
      cwd: appDir,
      shell: true,
      env: { ...process.env },
    });
    proc.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk.toString()));
    proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout: stdoutChunks.join(''),
        stderr: stderrChunks.join(''),
      });
    });
  });
}
