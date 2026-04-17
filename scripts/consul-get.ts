import axios, { AxiosError } from 'axios';

const CONSUL_URL = process.env.CONSUL_URL || 'http://localhost:8500';

interface ConsulKVItem {
  Key: string;
  Value: string;
}

async function getKey(key: string): Promise<void> {
  console.log(`\n📋 Getting Consul KV key: ${key}`);
  console.log(`   Consul URL: ${CONSUL_URL}\n`);

  try {
    const response = await axios.get<ConsulKVItem[]>(
      `${CONSUL_URL}/v1/kv/${key}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    if (!response.data || response.data.length === 0) {
      console.log(`  Key not found: ${key}`);
      return;
    }

    const item = response.data[0];
    const decodedValue = item.Value
      ? Buffer.from(item.Value, 'base64').toString('utf-8')
      : '(empty)';

    console.log(`✓ Key: ${item.Key}`);
    console.log(`  Value: ${decodedValue}\n`);

    console.log(`✅ Successfully retrieved key: ${key}`);
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 404) {
      console.error(`❌ Key not found: ${key}`);
    } else {
      console.error(`❌ Error: ${axiosError.message}`);
    }
    process.exit(1);
  }
}

// Main
const key = process.argv[2];

if (!key) {
  console.error('Usage: tsx scripts/consul-get.ts <key>');
  console.error('Example: tsx scripts/consul-get.ts /config/development/identity-service/database.url');
  process.exit(1);
}

getKey(key)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
