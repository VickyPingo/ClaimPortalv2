# Domain-Aware Multi-Tenancy Setup

## Overview

The application now supports domain-aware multi-tenancy with two distinct types of domains:

1. **Platform Domain** (claimsportal.co.za): Super Admin/Marketing site
2. **Tenant Domains** (claims.independi.co.za): Client-specific branded portals

## Domain Detection

The system automatically detects which domain the user is on and adjusts functionality accordingly:

### Platform Domain Behavior
- **Domain**: claimsportal.co.za (or localhost for development)
- **Purpose**: Marketing site and Super Admin access
- **Features**:
  - Shows generic landing page with role selection
  - Super Admin login only (no tenant data access)
  - No public signup allowed (admin accounts only)
  - No brokerage filtering (platform-level access)

### Tenant Domain Behavior
- **Domain**: claims.independi.co.za (or other configured subdomains)
- **Purpose**: Client-specific branded portal
- **Features**:
  - Shows branded landing page with brokerage logo/colors
  - Automatic brokerage detection based on subdomain
  - Public signup allowed for employees
  - All data filtered by brokerage_id (complete data isolation)
  - Invitation system for employee onboarding

## How It Works

### 1. Domain Detection (BrokerageContext)

```typescript
const hostname = window.location.hostname;
const platformDomains = ['claimsportal.co.za', 'localhost', '127.0.0.1'];
const isPlatform = platformDomains.includes(hostname);
```

The `BrokerageContext` provides:
- `isPlatformDomain`: Boolean indicating if on platform domain
- `currentDomain`: The actual hostname
- `brokerage`: Brokerage configuration (null for platform domain)
- `loading`: Loading state
- `error`: Error message if brokerage not found (only on tenant domains)

### 2. Landing Page Routing (AuthGate)

**On Platform Domain (claimsportal.co.za):**
- Shows `Landing` component with role selection
- Clicking "File a Claim" or "Broker Login" shows appropriate login form
- Super Admin login header displayed

**On Tenant Domain (claims.independi.co.za):**
- Shows branded landing page with brokerage logo and colors
- Single "Sign In" button
- Displays brokerage name prominently

### 3. Authentication Flow

**Platform Domain:**
```
User visits claimsportal.co.za
  → Sees Landing page with role selection
  → Clicks "Broker Login"
  → Shows "Super Admin Login" form
  → Signs in with admin credentials
  → Accesses platform-level admin dashboard
```

**Tenant Domain:**
```
User visits claims.independi.co.za
  → Sees Independi-branded landing page
  → Clicks "Sign In"
  → Shows login form
  → Can sign up if registered with Independi
  → All queries filtered to Independi brokerage_id
```

### 4. Data Isolation

All database queries automatically scope to the user's brokerage:

**Row Level Security (RLS) Policies:**
- Each table has RLS enabled
- Policies check `brokerage_id` column matches user's profile
- Users can ONLY see/modify data from their brokerage

**Example Policy:**
```sql
CREATE POLICY "Users can view own brokerage claims"
  ON claims FOR SELECT
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_profiles WHERE id = auth.uid()
      UNION
      SELECT brokerage_id FROM client_profiles WHERE id = auth.uid()
    )
  );
```

## Configuration

### Database Setup

**Brokerages Table:**
```sql
CREATE TABLE brokerages (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  subdomain text UNIQUE NOT NULL,  -- e.g., 'claims.independi.co.za'
  logo_url text,
  brand_color text DEFAULT '#1E40AF',
  notification_email text
);
```

**Existing Brokerage:**
```sql
-- Independi brokerage
INSERT INTO brokerages (id, name, subdomain, brand_color)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Independi',
  'claims.independi.co.za',
  '#1E40AF'
);
```

### Adding New Tenants

To add a new client brokerage:

1. **Insert Brokerage Record:**
```sql
INSERT INTO brokerages (name, subdomain, brand_color, logo_url)
VALUES (
  'New Client Name',
  'claims.newclient.co.za',
  '#FF5733',  -- Brand color
  'https://example.com/logo.png'  -- Optional logo
);
```

2. **Configure DNS:**
- Point the subdomain (e.g., claims.newclient.co.za) to your application
- Ensure SSL certificate covers the subdomain

3. **Test:**
- Visit the new domain
- Verify branded landing page appears
- Test signup/login flows
- Confirm data isolation

## Environment Variables

No changes needed to environment variables. The system uses:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Development Mode

When running locally:
- **localhost** or **127.0.0.1** = Treated as platform domain
- To test tenant domains locally, you can:
  - Add entries to `/etc/hosts`:
    ```
    127.0.0.1 claims.independi.local
    ```
  - Update `BrokerageContext.tsx` to recognize your test domain

## Authentication Redirects

Auth redirects automatically stay on the same domain:

- Users on **claimsportal.co.za** stay on claimsportal.co.za
- Users on **claims.independi.co.za** stay on claims.independi.co.za
- No cross-domain redirects occur
- Session cookies are domain-specific

## Invitation System

The invitation system works with domain awareness:

**Creating Invitations:**
1. Broker logs into tenant domain (e.g., claims.independi.co.za)
2. Goes to Settings → Invitations
3. Creates invitation link
4. Link includes domain: `https://claims.independi.co.za/join?token=xyz`

**Using Invitations:**
1. New user clicks invitation link
2. System validates token matches domain
3. Shows "✓ Invitation Accepted" banner
4. Auto-assigns correct brokerage on signup
5. User can only access that brokerage's data

**Cross-Domain Protection:**
- Invitations are tied to specific subdomain
- Cannot use Independi invitation on another tenant's domain
- Validation checks both token validity and subdomain match

## Security Considerations

### Data Isolation
- RLS policies enforce brokerage-level isolation
- Users cannot access other brokerages' data
- Even with direct API access, policies prevent cross-tenant data leaks

### Authentication
- Each domain maintains separate auth context
- Platform admins don't automatically access tenant data
- Tenants cannot access platform admin features

### Invitation Security
- Tokens are cryptographically secure (32 random bytes)
- Subdomain validation prevents cross-domain usage
- Expiration and usage limits enforced
- Can be deactivated at any time

## Troubleshooting

### "Configuration Error" on Tenant Domain
- **Cause**: No brokerage record exists for the subdomain
- **Solution**: Insert brokerage record with matching subdomain

### Signup Not Working
- **Platform Domain**: Expected behavior (admin accounts only)
- **Tenant Domain**: Check brokerage exists for domain
- **With Invitation**: Verify token is valid and not expired

### Wrong Branding Showing
- **Check**: Brokerage record has correct subdomain
- **Verify**: DNS is pointing to correct domain
- **Clear**: Browser cache and reload

### User Can't See Claims
- **Verify**: User's profile has correct brokerage_id
- **Check**: RLS policies are enabled on claims table
- **Confirm**: User is logged in correctly

## API Reference

### BrokerageContext Hook

```typescript
const {
  brokerage,        // Brokerage config or null
  loading,          // Loading state
  error,            // Error message
  isPlatformDomain, // Boolean: is platform domain
  currentDomain     // Current hostname
} = useBrokerage();
```

### Database RPC Functions

**get_brokerage_by_subdomain:**
```sql
SELECT * FROM get_brokerage_by_subdomain('claims.independi.co.za');
```

**validate_invitation:**
```sql
SELECT * FROM validate_invitation('token', 'claims.independi.co.za');
```

## Production Checklist

Before going live:

- [ ] Configure DNS for all domains
- [ ] SSL certificates installed for all domains
- [ ] Brokerage records created for all tenants
- [ ] RLS policies enabled on all tables
- [ ] Test signup flow on each domain
- [ ] Test data isolation between tenants
- [ ] Verify invitation system works
- [ ] Test auth redirects stay on same domain
- [ ] Confirm platform admin access works
- [ ] Validate branding displays correctly

## Support

For issues or questions:
1. Check this documentation
2. Verify database configuration
3. Review browser console for errors
4. Check Supabase logs for RLS policy violations
