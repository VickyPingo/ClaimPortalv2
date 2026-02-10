# Domain-Aware Setup - Quick Reference

## What Was Implemented

Your application is now fully domain-aware and can distinguish between:

1. **claimsportal.co.za** - Platform/Super Admin domain
2. **claims.independi.co.za** - Independi tenant domain
3. Any future tenant domains you add

## How Users Experience Each Domain

### claimsportal.co.za (Platform Domain)

**Landing Page:**
- Generic "Claims Portal" branding
- Two options: "File a Claim" and "Broker Login"

**Broker Login:**
- Header shows "Super Admin Login"
- Message: "Access the platform admin dashboard"
- No signup option (platform access restricted)

**What Works:**
- Super admin authentication
- Platform-level access
- No brokerage filtering

### claims.independi.co.za (Tenant Domain)

**Landing Page:**
- Shows Independi logo/branding
- Large "Independi" heading
- Single "Sign In" button

**Login:**
- Standard login form
- Signup option available
- Shows "Registering with: Independi" banner

**What Works:**
- Broker/client authentication
- All data filtered to Independi brokerage
- Invitation system
- Complete data isolation

## Domain Detection Logic

The system automatically detects domains:

```typescript
// Platform domains (no brokerage required)
- claimsportal.co.za
- localhost
- 127.0.0.1

// Tenant domains (requires brokerage match)
- claims.independi.co.za
- claims.anyclient.co.za (if configured)
```

## Database Configuration

**Independi Brokerage:**
```
ID: 10000000-0000-0000-0000-000000000001
Name: Independi
Subdomain: claims.independi.co.za
Brand Color: #0066cc
Email: claims@independi.co.za
```

## Authentication Flow

### Platform Domain
```
Visit claimsportal.co.za
  → See role selection
  → Click "Broker Login"
  → See "Super Admin Login"
  → Sign in with admin credentials
  → Access platform dashboard
```

### Tenant Domain
```
Visit claims.independi.co.za
  → See Independi branding
  → Click "Sign In"
  → Login or signup
  → Access tenant-specific dashboard
  → All data scoped to Independi
```

## Auth Redirects

Auth redirects automatically stay on the same domain:
- Users on **claimsportal.co.za** remain on claimsportal.co.za
- Users on **claims.independi.co.za** remain on claims.independi.co.za
- No cross-domain redirects occur

## Data Filtering

All Supabase queries are automatically filtered:

**Tenant Domains:**
- Only see data where `brokerage_id` matches their brokerage
- Cannot access other tenants' data
- RLS policies enforce isolation

**Platform Domain:**
- Platform-level access (no brokerage filtering)
- Used for super admin functions

## Adding New Tenant Domains

To add a new client (e.g., claims.newclient.co.za):

1. **Insert brokerage record:**
```sql
INSERT INTO brokerages (name, subdomain, brand_color, logo_url)
VALUES (
  'New Client',
  'claims.newclient.co.za',
  '#FF5733',
  'https://example.com/logo.png'
);
```

2. **Configure DNS:**
- Point claims.newclient.co.za to your app
- Ensure SSL certificate covers subdomain

3. **Test:**
- Visit claims.newclient.co.za
- Verify branded landing page
- Test signup/login
- Confirm data isolation

## Files Modified

### BrokerageContext.tsx
- Added `isPlatformDomain` flag
- Platform domains don't require brokerage
- Tenant domains load brokerage by subdomain

### AuthGate.tsx
- Platform domain shows Landing component
- Tenant domain shows branded landing
- Different routing based on domain type

### Login.tsx
- Accepts `roleType` prop for platform domain
- Shows "Super Admin Login" on platform
- Hides signup on platform domain
- Domain-aware validation

## Testing Checklist

### Test Platform Domain (claimsportal.co.za)
- [ ] Shows generic landing page
- [ ] Role selection works
- [ ] "Broker Login" shows super admin header
- [ ] No signup option visible
- [ ] Platform admins can login

### Test Tenant Domain (claims.independi.co.za)
- [ ] Shows Independi branding
- [ ] Logo/colors display correctly
- [ ] Signup works for new users
- [ ] Login works for existing users
- [ ] All data filtered to Independi
- [ ] Cannot see other tenants' data
- [ ] Invitation system works

### Test Auth Redirects
- [ ] Login on platform stays on platform
- [ ] Login on tenant stays on tenant
- [ ] No unexpected redirects
- [ ] Session persists on same domain

## Troubleshooting

**"Configuration Error" on tenant domain:**
- Check brokerage exists with matching subdomain
- Verify DNS is pointing correctly

**Wrong branding showing:**
- Verify subdomain in database matches actual domain
- Clear browser cache

**Data not filtered correctly:**
- Check user profile has correct brokerage_id
- Verify RLS policies are enabled

## Environment Variables

No changes needed. Uses existing:
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Documentation

See **DOMAIN_AWARE_SETUP.md** for complete documentation including:
- Architecture details
- Security considerations
- API reference
- Production checklist
- Advanced troubleshooting
