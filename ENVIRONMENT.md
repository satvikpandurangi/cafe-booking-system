# Environment Configuration

Create `.env.example` with names only.

Suggested variables:

```env
DATABASE_URL=
SESSION_SECRET=
OTP_PROVIDER_KEY=
UPI_ID=
PAYMENT_GATEWAY_KEY=
PAYMENT_GATEWAY_SECRET=
ADMIN_SEED_EMAIL=
ADMIN_SEED_PASSWORD=
STORAGE_BUCKET=
```

Never commit real credentials.

Production secrets must be injected through the deployment environment.
