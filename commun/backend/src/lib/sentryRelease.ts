import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Release Sentry backend : soundy-api@version+gitsha */
export function resolveBackendSentryRelease(): string {
  const explicit = process.env.SENTRY_RELEASE?.trim();
  if (explicit) return explicit;

  const slug = process.env.SENTRY_RELEASE_SLUG?.trim() || 'soundy-api';
  let version = process.env.APP_VERSION?.trim() || '';
  if (!version) {
    try {
      const pkgPath = path.join(__dirname, '..', '..', 'package.json');
      version = String(JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || '1.0.0');
    } catch {
      version = '1.0.0';
    }
  }

  let sha =
    process.env.SENTRY_RELEASE_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim()?.slice(0, 7) ||
    '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD', {
        cwd: path.join(__dirname, '..', '..', '..'),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      sha = '';
    }
  }

  return sha ? `${slug}@${version}+${sha}` : `${slug}@${version}`;
}
