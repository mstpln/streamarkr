import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, '..');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, '.wrangler', 'site');
const ROOT_FILES = ['index.html', 'manifest.webmanifest', 'sw.js', 'sw-manifest.json'];

export async function prepareWorkerAssets({ projectRoot = PROJECT_ROOT, outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  for (const file of ROOT_FILES) {
    await cp(path.join(projectRoot, file), path.join(outputDir, file));
  }

  await cp(path.join(projectRoot, 'dist'), path.join(outputDir, 'dist'), { recursive: true });
  await mkdir(path.join(outputDir, 'src', 'styles'), { recursive: true });
  await cp(path.join(projectRoot, 'src', 'styles', 'main.css'), path.join(outputDir, 'src', 'styles', 'main.css'));
  await cp(path.join(projectRoot, 'public'), path.join(outputDir, 'public'), { recursive: true });

  return outputDir;
}

const invokedAsScript = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedAsScript) {
  try {
    await prepareWorkerAssets();
    console.log('Prepared Streamarkr same-origin Worker static assets.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Failed to prepare Streamarkr Worker assets.');
    process.exitCode = 1;
  }
}
