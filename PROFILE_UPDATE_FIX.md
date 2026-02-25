# Runtime Profile Update Fix

## Problem
Client profiles were not being updated correctly during login:
- `brokerage_id` remained NULL
- `email` and `full_name` remained empty
- Clients received "Access Denied" errors

## Root Causes

1. **Wrong column name**: Code was trying to update `organization_id` instead of checking the correct table structure
2. **Wrong query field**: Code was using `.eq('user_id', userId)` but the `profiles` table uses `id` as the primary key that references `auth.users(id)`
3. **Missing error handling**: No logging to identify when updates failed

## Database Schema

### profiles table
```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  full_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('broker', 'client')),
  ...
);
```

### client_profiles table
```sql
CREATE TABLE client_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  brokerage_id uuid NOT NULL REFERENCES brokerages(id),
  full_name text NOT NULL,
  email text NOT NULL,
  ...
);
```

## Fixes Applied

### 1. Corrected Query Field (src/contexts/AuthContext.tsx)

Changed all profile queries from `.eq('user_id', userId)` to `.eq('id', userId)`:

**Before:**
```typescript
.from('profiles')
.select('*')
.eq('user_id', userId)  // ❌ Wrong - profiles doesn't have user_id column
```

**After:**
```typescript
.from('profiles')
.select('*')
.eq('id', userId)  // ✅ Correct - id is the primary key
```

### 2. Added Comprehensive Error Handling

```typescript
const { data: brokerage, error: brokerageError } = await supabase
  .from('brokerages')
  .select('id')
  .or(`subdomain.eq.${subdomain},slug.eq.${subdomain}`)
  .maybeSingle();

if (brokerageError) {
  console.error('❌ Error fetching brokerage:', brokerageError);
} else if (brokerage) {
  console.log('✓ Found brokerage for subdomain:', subdomain, '→', brokerage.id);

  const { error: updateErr } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId);

  if (updateErr) {
    console.error('❌ PROFILE UPDATE FAILED:', updateErr);
  }
}
```

### 3. Enhanced Logging

Added detailed logging throughout the profile update process:
- Current profile state before update
- Brokerage lookup results
- Update payload being sent
- Success/failure of each step
- Final profile state after reload

### 4. Fixed All Profile Queries

Updated all instances in the file:
- Profile loading: `.eq('id', userId)`
- Profile updates: `.eq('id', userId)`
- Super admin checks: `.eq('id', userId)`
- Client profile queries: `.eq('id', userId)`

## Testing

### What to Test
1. **New client signup** on a subdomain (e.g., demo.claimsportal.co.za)
2. **Existing client login** with incomplete profile
3. **Console logs** should show:
   ```
   📝 Profile incomplete - updating with subdomain brokerage and user data
   ✓ Found brokerage for subdomain: demo → [brokerage-id]
   📤 Updating profile with: { organization_id: [...], email: [...], ... }
   ✓ Profile update successful
   ✓ Profile reloaded successfully
   ```

### Expected Outcome
- Client profile gets `organization_id` set to the brokerage's ID
- Client profile gets `email` and `full_name` populated
- Client can access the client portal without "Access Denied" errors

## Files Modified
1. `src/contexts/AuthContext.tsx` - Fixed all profile queries to use correct column names and added error handling
