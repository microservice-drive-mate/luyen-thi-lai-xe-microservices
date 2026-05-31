/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/identity-client';
import axios from 'axios';
import { DEMO_PASSWORD, allDemoUsers } from '../../../scripts/demo-seed-data';

const connectionString = process.env.DATABASE_URL;
const CONSUL_URL = process.env.CONSUL_URL || 'http://127.0.0.1:8500';
const MANAGED_REALM_ROLES = [
  'ADMIN',
  'CENTER_MANAGER',
  'INSTRUCTOR',
  'STUDENT',
] as const;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed identity data');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

interface KeycloakConfig {
  authServerUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
}

interface KeycloakRoleRepresentation {
  id: string;
  name: string;
}

interface KeycloakUserRepresentation {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
}

function resolveDefaultEnvironment(consulUrl: string): string {
  const normalized = consulUrl.toLowerCase();
  if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) {
    return 'development-local';
  }
  return 'development';
}

function parseConsulValue(raw: string): string {
  try {
    return String(JSON.parse(raw));
  } catch {
    return raw;
  }
}

async function fetchConsulValue(
  environment: string,
  serviceName: string,
  key: string,
): Promise<string> {
  const consulKey = `config/${environment}/${serviceName}/${key}`;
  const response = await axios.get(`${CONSUL_URL}/v1/kv/${consulKey}`);

  if (!response.data || response.data.length === 0) {
    throw new Error(`Consul key not found: ${consulKey}`);
  }

  const kvData = response.data[0] as { Value: string };
  const raw = Buffer.from(kvData.Value, 'base64').toString('utf-8');
  return parseConsulValue(raw);
}

async function fetchKeycloakConfig(): Promise<KeycloakConfig> {
  if (
    process.env.KEYCLOAK_AUTH_SERVER_URL &&
    process.env.KEYCLOAK_REALM &&
    process.env.KEYCLOAK_CLIENT_ID &&
    process.env.KEYCLOAK_CLIENT_SECRET
  ) {
    return {
      authServerUrl: process.env.KEYCLOAK_AUTH_SERVER_URL,
      realm: process.env.KEYCLOAK_REALM,
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    };
  }

  const environment =
    process.env.NODE_ENV || resolveDefaultEnvironment(CONSUL_URL);

  const [authServerUrl, realm, clientId, clientSecret] = await Promise.all([
    fetchConsulValue(environment, 'identity-service', 'keycloak.authServerUrl'),
    fetchConsulValue(environment, 'identity-service', 'keycloak.realm'),
    fetchConsulValue(environment, 'identity-service', 'keycloak.clientId'),
    fetchConsulValue(environment, 'identity-service', 'keycloak.clientSecret'),
  ]);

  return { authServerUrl, realm, clientId, clientSecret };
}

async function getAdminToken(config: KeycloakConfig): Promise<string> {
  const masterAdmin = process.env.KEYCLOAK_ADMIN || 'admin';
  const masterAdminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';
  const masterUrl = `${config.authServerUrl}/realms/master/protocol/openid-connect/token`;
  const masterParams = new URLSearchParams();
  masterParams.append('grant_type', 'password');
  masterParams.append('client_id', 'admin-cli');
  masterParams.append('username', masterAdmin);
  masterParams.append('password', masterAdminPassword);

  try {
    const response = await axios.post<{ access_token: string }>(
      masterUrl,
      masterParams.toString(),
      { headers: { 'content-type': 'application/x-www-form-urlencoded' } },
    );
    return response.data.access_token;
  } catch {
    // Fall back to the service account. It can manage users, but not all
    // realm-level import operations in every Keycloak setup.
  }

  const url = `${config.authServerUrl}/realms/${config.realm}/protocol/openid-connect/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', config.clientId);
  params.append('client_secret', config.clientSecret);

  const response = await axios.post<{ access_token: string }>(
    url,
    params.toString(),
    { headers: { 'content-type': 'application/x-www-form-urlencoded' } },
  );

  return response.data.access_token;
}

function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().replace(/\s+/g, ' ').split(' ');
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1) ?? '',
  };
}

async function findKeycloakUserByEmail(
  adminBaseUrl: string,
  token: string,
  email: string,
): Promise<KeycloakUserRepresentation | null> {
  const response = await axios.get<KeycloakUserRepresentation[]>(
    `${adminBaseUrl}/users`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { email, exact: true },
    },
  );
  return response.data[0] ?? null;
}

async function getRealmRole(
  adminBaseUrl: string,
  token: string,
  roleName: string,
): Promise<KeycloakRoleRepresentation> {
  const response = await axios.get<KeycloakRoleRepresentation>(
    `${adminBaseUrl}/roles/${roleName}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
}

async function ensureRealmRole(
  adminBaseUrl: string,
  token: string,
  roleName: string,
): Promise<void> {
  try {
    await getRealmRole(adminBaseUrl, token, roleName);
    return;
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 404) {
      throw error;
    }
  }

  await axios.post(
    `${adminBaseUrl}/roles`,
    { name: roleName },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

async function ensureManagedRealmRoles(
  adminBaseUrl: string,
  token: string,
): Promise<void> {
  for (const roleName of MANAGED_REALM_ROLES) {
    await ensureRealmRole(adminBaseUrl, token, roleName);
  }
}

async function getUserRealmRoles(
  adminBaseUrl: string,
  token: string,
  userId: string,
): Promise<KeycloakRoleRepresentation[]> {
  const response = await axios.get<KeycloakRoleRepresentation[]>(
    `${adminBaseUrl}/users/${userId}/role-mappings/realm`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
}

async function assignRealmRole(
  adminBaseUrl: string,
  token: string,
  userId: string,
  roleName: string,
): Promise<void> {
  const role = await getRealmRole(adminBaseUrl, token, roleName);
  const currentRoles = await getUserRealmRoles(adminBaseUrl, token, userId);
  const managedRoles = currentRoles.filter((item) =>
    MANAGED_REALM_ROLES.includes(
      item.name as (typeof MANAGED_REALM_ROLES)[number],
    ),
  );

  if (managedRoles.length > 0) {
    await axios.delete(`${adminBaseUrl}/users/${userId}/role-mappings/realm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: managedRoles,
    });
  }

  await axios.post(
    `${adminBaseUrl}/users/${userId}/role-mappings/realm`,
    [role],
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

async function resetPassword(
  adminBaseUrl: string,
  token: string,
  userId: string,
): Promise<void> {
  await axios.put(
    `${adminBaseUrl}/users/${userId}/reset-password`,
    { type: 'password', value: DEMO_PASSWORD, temporary: false },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

async function deleteKeycloakUser(
  adminBaseUrl: string,
  token: string,
  userId: string,
): Promise<void> {
  await axios.delete(`${adminBaseUrl}/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function partialImportDemoUsers(
  adminBaseUrl: string,
  token: string,
): Promise<void> {
  const users = allDemoUsers().map((user) => {
    const name = splitFullName(user.fullName);
    return {
      id: user.id,
      username: user.email,
      email: user.email,
      firstName: name.firstName,
      lastName: name.lastName,
      enabled: true,
      emailVerified: true,
      requiredActions: [],
      credentials: [
        { type: 'password', value: DEMO_PASSWORD, temporary: false },
      ],
      realmRoles: [user.role],
    };
  });

  await axios.post(
    `${adminBaseUrl}/partialImport`,
    {
      ifResourceExists: 'OVERWRITE',
      users,
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

async function removeConflictingKeycloakUsers(
  adminBaseUrl: string,
  token: string,
): Promise<void> {
  for (const user of allDemoUsers()) {
    const existing = await findKeycloakUserByEmail(
      adminBaseUrl,
      token,
      user.email,
    );
    if (existing && existing.id !== user.id) {
      await deleteKeycloakUser(adminBaseUrl, token, existing.id);
    }
  }
}

async function seedIdentityDatabase() {
  for (const user of allDemoUsers()) {
    await prisma.identityUser.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        name: user.fullName,
        role: user.role,
        isActive: true,
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.fullName,
        role: user.role,
      },
    });
  }

  console.log(`Seeded identity_db: ${allDemoUsers().length} demo users`);
}

async function seedKeycloak() {
  if (process.env.SKIP_KEYCLOAK_SEED === '1') {
    console.log('Skipped Keycloak demo users because SKIP_KEYCLOAK_SEED=1');
    return;
  }

  const config = await fetchKeycloakConfig();
  const token = await getAdminToken(config);
  const adminBaseUrl = `${config.authServerUrl}/admin/realms/${config.realm}`;

  await ensureManagedRealmRoles(adminBaseUrl, token);
  await removeConflictingKeycloakUsers(adminBaseUrl, token);
  await partialImportDemoUsers(adminBaseUrl, token);

  console.log(
    `Seeded Keycloak realm ${config.realm}: ${allDemoUsers().length} demo users, password=${DEMO_PASSWORD}`,
  );
}

async function main() {
  await seedIdentityDatabase();
  await seedKeycloak();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
