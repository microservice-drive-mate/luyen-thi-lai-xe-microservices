import axios, { AxiosError } from 'axios';

const CONSUL_URL = process.env.CONSUL_URL || 'http://localhost:8500';

interface ConsulKVItem {
  Key: string;
  Value: string;
}

async function listKeys(prefix: string): Promise<void> {
  console.log(`\n📋 Listing Consul KV keys with prefix: ${prefix}`);
  console.log(`   Consul URL: ${CONSUL_URL}\n`);

  try {
    const response = await axios.get<ConsulKVItem[]>(
      `${CONSUL_URL}/v1/kv/${prefix}?recurse`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    if (!response.data || response.data.length === 0) {
      console.log(`  No keys found with prefix: ${prefix}`);
      return;
    }

    console.log(`✓ Found ${response.data.length} keys:\n`);

    for (const item of response.data) {
      const decodedValue = item.Value
        ? Buffer.from(item.Value, 'base64').toString('utf-8')
        : '(empty)';
      console.log(`  Key: ${item.Key}`);
      console.log(`  Value: ${decodedValue}\n`);
    }

    console.log(`✅ Listed all keys with prefix: ${prefix}`);
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 404) {
      console.error(`❌ No keys found with prefix: ${prefix}`);
    } else {
      console.error(`❌ Error: ${axiosError.message}`);
    }
    process.exit(1);
  }
}

// Main
const prefix = process.argv[2];

if (!prefix) {
  console.error('Usage: tsx scripts/consul-list.ts <prefix>');
  console.error('Example: tsx scripts/consul-list.ts /config/development');
  process.exit(1);
}

listKeys(prefix)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
