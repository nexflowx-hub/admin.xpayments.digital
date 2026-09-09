# XPAYMENTS Admin Control Plane

Internal administrative frontend for XPAYMENTS.

## Architecture

- Frontend: Next.js App Router on Vercel
- Backend: `https://api.xpayments.digital/api/v1/control-plane/*`
- Authentication: server-side proxy + `HttpOnly`, `Secure`, `SameSite=Strict` cookie
- No Supabase client in the browser
- No Control Plane token in `localStorage`
- Production pages are `noindex` / `nofollow`

## Modules

- Command Center
- Merchants / Merchant 360°
- Stores
- Transactions
- Processing / Provider Accounts / Provider Connections
- Gateway Vaults (credentials redacted by backend)
- Fees & Tiers foundation
- Finance & Payouts
- XPay Expert
- Actors & Access
- Audit & Security

## Vercel

Import this GitHub repository as a new Vercel project.

Framework preset: **Next.js**

Root directory: repository root.

Optional environment variable:

```text
XPAYMENTS_API_URL=https://api.xpayments.digital
```

The application already defaults to the production XPAYMENTS API, so the variable is not mandatory for the first production deploy.

After the deployment succeeds:

1. Project → Settings → Domains
2. Add `admin.xpayments.digital`
3. Copy the exact DNS record requested by Vercel
4. In Cloudflare create that record for `admin`
5. Prefer **DNS only** during initial verification
6. Confirm SSL/domain verification in Vercel

## Security notes

The Control Plane is an internal application. Do not expose backend GatewayVault credentials in frontend code, environment variables, logs or screenshots. Write-enabled administrative operations should remain protected by backend RBAC and audit logs.
