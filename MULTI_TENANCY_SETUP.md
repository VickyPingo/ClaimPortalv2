# Multi-Tenancy Setup Guide

This document explains how the multi-tenant architecture works in the insurance claims platform.

## Overview

The platform supports multiple brokerages, each with their own subdomain, branding, and isolated data. For example:
- **Independi**: `claims.independi.co.za`
- **Default**: `app.claimsplatform.com`

## Architecture

### Database Schema

#### Brokerages Table
```sql
brokerages (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  subdomain text UNIQUE NOT NULL,
  logo_url text,
  brand_color text DEFAULT '#1e40af',
  notification_email text,
  created_at timestamptz DEFAULT now()
)
```

All data tables include a `brokerage_id` foreign key that links to the brokerages table:
- `broker_profiles`
- `client_profiles`
- `clients`
- `claims`
- `theft_claims`
- `motor_vehicle_theft_claims`
- `structural_damage_claims`
- `all_risk_claims`

### Row Level Security (RLS)

Data is strictly isolated by `brokerage_id` through PostgreSQL Row Level Security policies. Examples:

**Broker Access:**
```sql
-- Brokers can only view claims in their brokerage
CREATE POLICY "Brokers can view org claims"
  ON claims FOR SELECT
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_profiles
      WHERE id = auth.uid()
    )
  );
```

**Client Access:**
```sql
-- Clients can only view their own claims
CREATE POLICY "Clients can view own claims"
  ON claims FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

### Frontend Implementation

#### Subdomain Detection

The `BrokerageContext` automatically detects the current subdomain and loads the appropriate brokerage configuration:

```typescript
const hostname = window.location.hostname;
// e.g., "claims.independi.co.za"

const { data } = await supabase
  .rpc('get_brokerage_by_subdomain', { subdomain_param: hostname });
```

#### Context Hierarchy

```
App
├── BrokerageProvider (loads brokerage config by subdomain)
│   └── AuthProvider (uses brokerage_id for user authentication)
│       └── Application Components
```

#### Branding Application

Once loaded, the brokerage configuration is applied:
- **Brand Color**: Applied to buttons and UI elements
- **Logo**: Displayed on login and dashboard
- **Name**: Shown on the portal

```typescript
const { brokerage } = useBrokerage();
// {
//   id: "10000000-0000-0000-0000-000000000001",
//   name: "Independi",
//   subdomain: "claims.independi.co.za",
//   brand_color: "#0066cc",
//   logo_url: null,
//   notification_email: "claims@independi.co.za"
// }
```

## Adding a New Brokerage

### 1. Insert Brokerage Record

```sql
INSERT INTO brokerages (name, subdomain, brand_color, notification_email)
VALUES (
  'Your Brokerage Name',
  'claims.yourbrokerage.com',
  '#ff0000',  -- Brand color in hex
  'claims@yourbrokerage.com'
);
```

### 2. Configure DNS

Point the subdomain to your application:

```
Type: CNAME
Host: claims.yourbrokerage.com
Value: yourdomain.com
```

### 3. Test Access

Navigate to `https://claims.yourbrokerage.com` and verify:
- ✅ Branding loads correctly
- ✅ Sign up creates users with correct `brokerage_id`
- ✅ Data is isolated (can't see other brokerages' data)

## Development

### Local Development

For local development (localhost), the system defaults to `app.claimsplatform.com` subdomain.

To test specific brokerages locally:
1. Update your `/etc/hosts` file:
   ```
   127.0.0.1 claims.independi.local
   ```
2. Access via `http://claims.independi.local:5173`
3. Update `BrokerageContext.tsx` to handle `.local` domains

### Environment Variables

No environment variables needed for multi-tenancy. Configuration is stored in the database and loaded dynamically.

## Security Considerations

1. **RLS Policies**: Always enabled and enforce strict isolation
2. **Subdomain Validation**: Only registered subdomains can access the platform
3. **No Cross-Tenant Queries**: Database policies prevent data leakage
4. **Authentication Scoped**: Users are always created within their brokerage context

## Helper Functions

### Get Brokerage by Subdomain

```sql
SELECT * FROM get_brokerage_by_subdomain('claims.independi.co.za');
```

Returns brokerage configuration for the given subdomain.

## Troubleshooting

### "Brokerage not found" Error

**Cause**: The subdomain doesn't exist in the `brokerages` table.

**Solution**: Add the subdomain to the database:
```sql
INSERT INTO brokerages (name, subdomain)
VALUES ('New Brokerage', 'subdomain.example.com');
```

### Data Not Appearing

**Cause**: RLS policies blocking access or wrong `brokerage_id` on records.

**Solution**: Verify the record has the correct `brokerage_id`:
```sql
SELECT id, brokerage_id FROM claims WHERE id = 'claim-uuid';
```

### Branding Not Applying

**Cause**: CSS variables not being set or brand_color is null.

**Solution**: Ensure `brand_color` is set in the brokerages table:
```sql
UPDATE brokerages
SET brand_color = '#0066cc'
WHERE subdomain = 'claims.independi.co.za';
```
