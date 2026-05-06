import axios, { AxiosError } from 'axios';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ConsulSeedConfig {
  [key: string]: string | number | boolean | ConsulSeedConfig;
}

interface ConsulKVEntry {
  key: string;
  value: string;
}

const CONSUL_URL = process.env.CONSUL_URL || 'http://localhost:8500';
const DEFAULT_ENV = process.env.ENV || 'development';

async function flatten(
  obj: ConsulSeedConfig,
  prefix: string = '',
): Promise<ConsulKVEntry[]> {
  const entries: ConsulKVEntry[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}/${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      entries.push(...(await flatten(value as ConsulSeedConfig, fullKey)));
    } else {
      entries.push({ key: fullKey, value: JSON.stringify(value) });
    }
  }

  return entries;
}

async function cleanConsulPrefix(prefix: string): Promise<void> {
  try {
    await axios.delete(`${CONSUL_URL}/v1/kv/${prefix}?recurse`);
    console.log(`  🗑 Deleted stale keys under: ${prefix}`);
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status !== 404) {
      console.warn(
        `  ⚠ Could not clean prefix ${prefix}: ${axiosError.message}`,
      );
    }
  }
}

async function seedConsul(env: string): Promise<void> {
  console.log(`\n📋 Seeding Consul KV Store for environment: ${env}`);

  // Load seed file
  const seedFile = path.join(__dirname, `../consul-seed-${env}.json`);

  if (!fs.existsSync(seedFile)) {
    throw new Error(`Seed file not found: ${seedFile}`);
  }

  console.log(`📂 Loading seed file: ${seedFile}`);
  const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));

  // Lấy config của đúng environment từ seed file
  const envConfig = seedData[env] as ConsulSeedConfig;
  if (!envConfig) {
    throw new Error(
      `Environment "${env}" not found in seed file. Available: ${Object.keys(seedData).join(', ')}`,
    );
  }

  // Clean stale keys before re-seeding to avoid leftover slash-vs-dot duplicates
  console.log(`\n🧹 Cleaning existing keys under config/${env}/...`);
  await cleanConsulPrefix(`config/${env}/`);

  // Flatten the hierarchical config (không có leading slash để khớp với ConsulConfigService)
  const entries = await flatten(envConfig, `config/${env}`);

  console.log(`\n✓ Found ${entries.length} configuration keys to seed`);

  // Upload each entry to Consul
  let successCount = 0;
  let failCount = 0;

  for (const entry of entries) {
    try {
      const response = await axios.put(
        `${CONSUL_URL}/v1/kv/${entry.key}`,
        entry.value,
        {
          headers: {
            'Content-Type': 'text/plain',
          },
        },
      );

      if (response.status === 200) {
        console.log(`  ✓ ${entry.key}`);
        successCount++;
      } else {
        console.error(`  ✗ ${entry.key} - Status: ${response.status}`);
        failCount++;
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(`  ✗ ${entry.key} - Error: ${axiosError.message}`);
      failCount++;
    }
  }

  console.log(`\n📊 Seeding Summary:`);
  console.log(`  ✓ Successful: ${successCount}`);
  console.log(`  ✗ Failed: ${failCount}`);

  if (failCount > 0) {
    throw new Error(`Failed to seed ${failCount} keys. See errors above.`);
  }

  console.log(`\n✅ Successfully seeded ${successCount} keys to Consul`);
}

// Main
const env = process.argv[2] || DEFAULT_ENV;

console.log(`🚀 Consul KV Seed Script`);
console.log(`   Consul URL: ${CONSUL_URL}`);
console.log(`   Environment: ${env}`);

seedConsul(env)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
