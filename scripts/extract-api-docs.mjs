#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { extractApiDocs } from '../src/engine/api-docs.ts';

export { extractApiDocs };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(extractApiDocs());
}
