# Forgot Password Email Summary

Forgot-password flow is owned by `identity-service`, but the actual email delivery is delegated to Keycloak. The API `POST /forgot-password` only validates the request shape, finds the Keycloak user by email, and asks Keycloak to send an `UPDATE_PASSWORD` action email.

For local development, Docker uses Mailpit by default:

- SMTP endpoint inside Docker: `mailpit:1025`
- Mailpit UI on host: `http://localhost:8025`

For real-inbox dev/demo, configure Keycloak SMTP through root `.env` variables consumed by the `keycloak-smtp-config` Docker Compose sidecar.

The easiest provider while the project has no private domain is Gmail SMTP with an App Password. This is useful for development/demo, but production should use a verified private domain with a transactional provider.

```env
KEYCLOAK_SMTP_HOST=smtp.gmail.com
KEYCLOAK_SMTP_PORT=587
KEYCLOAK_SMTP_FROM=your-gmail-address@gmail.com
KEYCLOAK_SMTP_FROM_DISPLAY_NAME=Luyen Thi Lai Xe
KEYCLOAK_SMTP_REPLY_TO=your-gmail-address@gmail.com
KEYCLOAK_SMTP_REPLY_TO_DISPLAY_NAME=Luyen Thi Lai Xe
KEYCLOAK_SMTP_AUTH=true
KEYCLOAK_SMTP_USER=your-gmail-address@gmail.com
KEYCLOAK_SMTP_PASSWORD=<gmail-app-password>
KEYCLOAK_SMTP_SSL=false
KEYCLOAK_SMTP_STARTTLS=true
```

Apply or re-apply SMTP settings without recreating Keycloak data:

```bash
docker compose up -d --force-recreate keycloak-smtp-config

# Infra-only mode:
docker compose -f docker-compose.infra.yml up -d --force-recreate keycloak-smtp-config
```

Production checklist:

- Use a verified private sender/domain.
- Configure SPF, DKIM, and DMARC.
- Keep SMTP password or provider token in CI/CD secrets or server secrets, never in git.
- Keep forgot-password response generic so attackers cannot enumerate emails.
