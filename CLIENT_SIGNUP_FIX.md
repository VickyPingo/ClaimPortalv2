# Client Signup Profile Creation and Routing Fix

## Problem
When new clients signed up:
1. Profile was created with `role` only in `client_profiles` table
2. `email`, `full_name`, and `brokerage_id` were NULL
3. Clients were being routed to Broker Admin dashboard instead of Client Portal
4. The `profiles` table had no entry for clients, causing authentication to fail

## Root Cause
The `handle_new_user()` database trigger only created entries in the legacy `client_profiles` table for clients, not in the unified `profiles` table that the AuthContext now uses for routing.

## Solution

### 1. Database Migration (fix_client_signup_profiles_table)
Updated the `handle_new_user()` trigger to:
- Create profile in BOTH `profiles` AND `client_profiles` tables for clients
- Use `brokerage_slug` from metadata to look up the correct `organization_id` from the `brokerages` table
- Set `role='client'` in the `profiles` table
- Populate `email`, `full_name`, `cell_number` from user metadata
- Set `is_active=true` by default
- Add `user_id` field to both tables

The trigger now:
```sql
-- Look up organization_id from brokerages table using slug
SELECT id INTO organization_id_val
FROM brokerages
WHERE slug = brokerage_slug_val OR subdomain = brokerage_slug_val
LIMIT 1;

-- Create entry in profiles table
INSERT INTO profiles (
  id, user_id, organization_id, full_name, email,
  cell_number, role, is_active
)
VALUES (
  NEW.id, NEW.id, organization_id_val, full_name_val,
  NEW.email, cell_number_val, 'client', true
)
ON CONFLICT (id) DO UPDATE SET ...;

-- Also create in client_profiles for backward compatibility
INSERT INTO client_profiles (...) VALUES (...);
```

### 2. AuthContext Updates (src/contexts/AuthContext.tsx)

#### Added Client Role Handling
Added logic to handle `role='client'` in the `profiles` table:
```typescript
if (profileWithBrokerageId.role === 'client') {
  console.log('✓ Client profile found in profiles table');
  setUserType('client');
  setUserRole('client');
  setBrokerageId(brokerageId);
  setClientProfile({
    id: profileWithBrokerageId.id,
    full_name: profileWithBrokerageId.full_name || '',
    email: profileWithBrokerageId.email || '',
    cell_number: profileWithBrokerageId.cell_number || '',
    brokerage_id: brokerageId,
    role: 'client'
  });
  setLoading(false);
  return;
}
```

#### Deactivation Check
Added checks for deactivated users in both broker and client profiles:
```typescript
if (brokerProfileData.is_active === false) {
  await supabase.auth.signOut();
  setError('Your account has been deactivated. Please contact your broker administrator.');
  return;
}
```

### 3. Subdomain Utilities (src/utils/subdomain.ts)
Added `getSubdomainBrokerageId()` helper function (though ultimately not used in AuthContext since the trigger handles it):
```typescript
export async function getSubdomainBrokerageId(): Promise<string | null> {
  const response = await fetch('/.netlify/functions/get-brokerage-from-host', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  const result = await response.json();
  if (result.success && result.brokerage) {
    return result.brokerage.id;
  }
  return null;
}
```

### 4. Routing (HomePageRouter)
Routing was already correct - clients with `role='client'` are routed to `/claims-portal` which displays the `ClientPortal` component.

## How It Works Now

### Client Signup Flow
1. User signs up via `clientSignUp()` with metadata:
   ```typescript
   {
     role: 'client',
     user_type: 'client',
     brokerage_slug: 'independi',
     full_name: 'John Doe',
     cell_number: '+27821234567'
   }
   ```

2. Supabase creates auth user

3. `handle_new_user()` trigger fires:
   - Looks up brokerage ID from `brokerages` table using slug
   - Creates entry in `profiles` table with full data
   - Creates entry in `client_profiles` table (backward compatibility)

4. AuthContext loads user:
   - Checks `profiles` table
   - Finds `role='client'`
   - Sets `userType='client'` and `userRole='client'`
   - Populates `clientProfile` from `profiles` data

5. HomePageRouter routes user:
   - Detects `userRole === 'client'`
   - Routes to `/claims-portal`
   - Displays `ClientPortal` component

### Deactivation Flow
1. Admin deactivates user in Team Management
2. `is_active` set to `false` in `profiles` table
3. On next login or session refresh:
   - AuthContext checks `is_active`
   - If false, signs user out
   - Shows error: "Your account has been deactivated. Please contact your broker administrator."

## Testing Checklist
- [x] Client signup creates profile in `profiles` table
- [x] Profile has correct `email`, `full_name`, `organization_id`
- [x] Profile has `role='client'`
- [x] Profile has correct `brokerage_id` from subdomain
- [x] Client is routed to `/claims-portal` (ClientPortal)
- [x] Client is NOT routed to broker dashboard
- [x] Deactivated clients cannot log in
- [x] Error message shown for deactivated accounts

## Files Modified
1. `supabase/migrations/[timestamp]_fix_client_signup_profiles_table.sql` - Database trigger update
2. `src/contexts/AuthContext.tsx` - Client role handling and deactivation checks
3. `src/utils/subdomain.ts` - Helper function for brokerage ID lookup
4. `src/components/Login.tsx` - Display auth errors from context

## Notes
- Maintains backward compatibility with `client_profiles` table
- Uses unified `profiles` table for all user types (super_admin, broker, main_broker, client)
- Proper subdomain-to-brokerage mapping via `brokerages` table
- Deactivation system works for both brokers and clients
