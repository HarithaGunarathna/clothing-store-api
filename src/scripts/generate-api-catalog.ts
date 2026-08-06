/**
 * Renders openapi.json and API_CATALOG.md from the live Nest application, so the
 * catalog is generated from the controllers rather than maintained by hand and
 * cannot drift from the routes that actually exist.
 *
 *   npm run api:catalog
 *
 * Lives under src/ and runs from dist/ for the same reason the TypeORM CLI does:
 * `module: nodenext` conflicts with ts-node. Booting the app means a reachable
 * database is required, exactly as for the migration scripts.
 */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { OpenAPIObject } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { AppModule } from '../app.module';
import { buildOpenApiDocument } from '../config/swagger.setup';

config();

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface Row {
  method: string;
  path: string;
  auth: string;
  summary: string;
}

const authOf = (op: Record<string, any>): string => {
  const security = (op.security as Record<string, unknown>[] | undefined) ?? [];
  if (security.some((s) => 'access-token' in s)) return 'Bearer token';
  if (security.some((s) => 'refresh_token' in s)) return 'Refresh cookie';
  return 'Public';
};

const renderMarkdown = (doc: OpenAPIObject): string => {
  const byTag = new Map<string, Row[]>();

  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of METHODS) {
      const op = (item as Record<string, any>)[method] as
        Record<string, any> | undefined;
      if (!op) continue;

      const tag = ((op.tags as string[]) ?? ['untagged'])[0];
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push({
        method: method.toUpperCase(),
        path,
        auth: authOf(op),
        summary: (op.summary as string) ?? '',
      });
    }
  }

  const total = [...byTag.values()].reduce((n, rows) => n + rows.length, 0);

  const lines: string[] = [
    '# API Catalog',
    '',
    '<!-- GENERATED FILE — do not edit by hand.',
    '     Run `npm run api:catalog` after changing any route. -->',
    '',
    `Generated from the controllers. **${total} endpoints** across ` +
      `${byTag.size} groups.`,
    '',
    'Interactive docs run at `GET /api/docs` when `SWAGGER_ENABLED` is true;',
    'the machine-readable spec is [`openapi.json`](openapi.json).',
    '',
    '> `AuthGuard` is registered **globally**: every route requires a valid Bearer',
    '> access token unless it is marked `@Public()`. The Auth column below is',
    '> enforced, not aspirational. "Refresh cookie" routes are public to the guard',
    '> and authenticate with the httpOnly cookie instead.',
    '',
  ];

  for (const [tag, rows] of [...byTag.entries()].sort()) {
    lines.push(`## ${tag}`, '');
    lines.push('| Method | Path | Auth | Description |');
    lines.push('|---|---|---|---|');
    for (const row of rows.sort((a, b) => a.path.localeCompare(b.path))) {
      lines.push(
        `| ${row.method} | \`${row.path}\` | ${row.auth} | ${row.summary} |`,
      );
    }
    lines.push('');
  }

  lines.push(
    '---',
    '',
    'Error messages the client can receive, and how to surface them, are in',
    '[CLAUDE_FRONTEND.md](CLAUDE_FRONTEND.md) §6.',
    '',
  );

  return lines.join('\n');
};

async function main() {
  // `logger: false` keeps Nest's startup banner out of the script output.
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();

  const doc = buildOpenApiDocument(app, app.get(ConfigService));
  // dist/scripts -> repo root
  const root = join(__dirname, '..', '..');

  writeFileSync(
    join(root, 'openapi.json'),
    JSON.stringify(doc, null, 2) + '\n',
  );
  writeFileSync(join(root, 'API_CATALOG.md'), renderMarkdown(doc));

  const paths = Object.keys(doc.paths ?? {}).length;
  console.log(`Wrote openapi.json and API_CATALOG.md (${paths} paths)`);

  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
