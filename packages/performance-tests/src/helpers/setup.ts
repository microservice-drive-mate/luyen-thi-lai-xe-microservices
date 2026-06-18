import http from 'k6/http';

const KEYCLOAK_URL = __ENV.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = 'luyen-thi-lai-xe-realm';

export function setupKeycloak(): void {
  // 1. Get Admin Token
  const tokenRes = http.post(
    `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
    {
      grant_type: 'password',
      client_id: 'admin-cli',
      username: 'admin',
      password: 'admin',
    },
  );

  if (tokenRes.status !== 200) {
    console.error('[setup] Failed to get Keycloak Admin Token', tokenRes.body);
    return;
  }

  const token = (tokenRes.json() as any).access_token;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 2. Hạ chuẩn băm mật khẩu Local (hash iterations = 1)
  const realmRes = http.put(
    `${KEYCLOAK_URL}/admin/realms/${REALM}`,
    JSON.stringify({ passwordPolicy: 'hashIterations(1)' }),
    { headers: authHeaders },
  );
  if (realmRes.status >= 300) {
    console.error('[setup] Failed to update password policy', realmRes.body);
  } else {
    console.log(
      '[setup] Lowered Keycloak hash iterations to 1 for Local Testing',
    );
  }

  // 3. Gắn quyền realm:ADMIN cho Service Account của exam-service (client: nestjs-backend)
  const usersRes = http.get(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/users?username=service-account-nestjs-backend&exact=true`,
    { headers: authHeaders },
  );

  if (usersRes.status !== 200) {
    console.error('[setup] Failed to get service account', usersRes.body);
    return;
  }

  const users = usersRes.json() as any[];
  if (!users || users.length === 0) {
    console.error('[setup] Service account not found');
    return;
  }
  const serviceAccountId = users[0].id;

  const roleRes = http.get(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/ADMIN`,
    { headers: authHeaders },
  );

  if (roleRes.status !== 200) {
    console.error('[setup] Failed to get ADMIN role', roleRes.body);
    return;
  }

  const adminRole = roleRes.json() as any;

  const assignRes = http.post(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${serviceAccountId}/role-mappings/realm`,
    JSON.stringify([
      {
        id: adminRole.id,
        name: adminRole.name,
      },
    ]),
    { headers: authHeaders },
  );

  if (assignRes.status >= 300 && assignRes.status !== 409) {
    console.error('[setup] Failed to assign ADMIN role', assignRes.body);
  } else {
    console.log('[setup] Assigned realm:ADMIN to exam-service successfully');
  }
}
