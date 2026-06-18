import { mkdir, readdir, rm } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { build } from 'esbuild';

const CONFIG = {
  srcDir: './src/scenarios',
  outDir: './dist',
};

// Recreate a clean output directory to prevent stale artifacts
async function cleanOutputDirectory() {
  console.log(`\u2699\ufe0f  Cleaning output directory: ${CONFIG.outDir}...`);
  await rm(CONFIG.outDir, { recursive: true, force: true });
  await mkdir(CONFIG.outDir, { recursive: true });
}

// Auto-discover all TypeScript files in the scenarios directory
async function getEntryPoints() {
  const files = await readdir(CONFIG.srcDir, { withFileTypes: true });
  const entryPoints = files
    .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.ts'))
    .map((dirent) => join(CONFIG.srcDir, dirent.name));

  if (entryPoints.length === 0) {
    throw new Error(`No TypeScript scenarios found in ${CONFIG.srcDir}`);
  }
  return entryPoints;
}

// Bundle a single scenario optimized for the K6 runtime
async function buildScenario(entryPoint) {
  const { name } = parse(entryPoint);
  const outfile = join(CONFIG.outDir, `${name}.js`);

  await build({
    entryPoints: [entryPoint],
    bundle: true,
    outfile,
    platform: 'neutral', // Required for K6's specific JS runtime
    target: 'es2020',
    format: 'esm',
    external: ['k6', 'k6/*'], // Prevent esbuild from bundling K6 built-ins
    sourcemap: 'inline',
    minify: process.env.NODE_ENV === 'production',
  });

  return outfile;
}

async function main() {
  try {
    const startTime = performance.now();
    await cleanOutputDirectory();

    const entryPoints = await getEntryPoints();
    console.log(`\ud83d\udd0d Found ${entryPoints.length} scenarios to build.`);

    // Build all scenarios concurrently
    const generatedFiles = await Promise.all(entryPoints.map(buildScenario));

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`\n\u2705 K6 scenarios bundled successfully in ${duration}ms:`);
    for (const file of generatedFiles) {
      console.log(`   \u2192 ${file}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n\u274c Build process failed:', error.message || error);
    process.exit(1); // Ensure CI/CD pipelines fail appropriately
  }
}

main();
