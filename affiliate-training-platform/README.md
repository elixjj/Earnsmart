# Multi-Tiered Affiliate Online Training Platform

Netlify-ready frontend + serverless Node.js functions + Supabase PostgreSQL.

## Important KCB integration note

KCB Buni sandbox endpoint paths and exact request schemas can vary by the credentials/API product provisioned to an account. The function keeps the KCB base URL and endpoint paths configurable through environment variables rather than hard-coding undocumented paths.

Set:
- `KCB_BASE_URL`
- `KCB_TOKEN_PATH`
- `KCB_STK_PATH`

The default paths are conventional Buni paths and should be verified against the KCB Buni Developer Portal documentation for the credentials you receive.

## Business flow

1. Visitor opens `/?ref=AGENTCODE`.
2. Referral code is stored and displayed.
3. Registration is first saved as `pending`.
4. The STK function initiates a KES 100 payment.
5. KCB callback/webhook validates success.
6. Recruiter receives KES 80 commission.
7. Company retains KES 20.
8. Paying trainee becomes an active agent and receives a unique referral code.
9. Dashboard shows recruiter metrics and referral history.

## Security model

- Supabase service-role key is used only by Netlify functions.
- Browser never receives the service-role key.
- CORS is restricted through `ALLOWED_ORIGIN` when configured.
- Webhook accepts only POST.
- Duplicate payment callbacks are guarded by checking existing commission records.
- Payment ownership is resolved from the stored pending trainee phone plus optional transaction reference.
- The webhook does not trust a client-supplied payment-success request.

## Supabase

Open `supabase/schema.sql` in the Supabase SQL Editor and run it.

## Netlify deployment

1. Push this directory to GitHub.
2. In Netlify, create a site from the repository.
3. No build command is required.
4. Publish directory: `.`
5. Functions directory is already configured as `netlify/functions`.
6. Add the environment variables listed in `.env.example`.
7. Deploy.
8. Test registration with a KCB sandbox phone.
9. Configure KCB's webhook/callback URL as:
   `https://YOUR-SITE.netlify.app/api/kcb-webhook`

## Environment variables

See `.env.example`.

## Dashboard

Open:
`https://YOUR-SITE.netlify.app/dashboard.html`

Enter an agent code to retrieve its stats.

## Commission payout status

The current schema includes commission records and a payout-status field so the dashboard can distinguish pending/unpaid and paid commission records. Actual money disbursement is intentionally not automated by this package because a payout API/approval workflow was not specified.

## Production checklist

- Replace sandbox KCB credentials with approved production credentials.
- Verify exact KCB OAuth/STK endpoint paths and payload names against the Buni product documentation supplied with your account.
- Configure the exact callback authentication/signature mechanism required by KCB, if enabled for your account.
- Set `ALLOWED_ORIGIN` to the final HTTPS site origin.
- Add rate limiting/WAF rules at the edge.
- Configure Supabase backups and database monitoring.
- Add an authenticated agent dashboard before exposing sensitive agent statistics in a real production deployment.
