# Runtime Profile Update Fix

## Problem
Client profiles were not being updated correctly during login:
- `brokerage_id` remained NULL
- `email` and `full_name` remained empty
- Clients received "Access Denied" errors

## Root Causes

1. **Missing column**: The `profiles` table didn't have a `brokerage_id` column
2. **Wrong query field**: Code needed to use `.eq('user_id', userId)` to query profiles
3. **Wrong column reference**: Code was using `organization_id` instead of `brokerage_id`
4. **Missing error handling**: No logging to identify when updates failed

## Database Schema

### profiles table (UPDATED)
```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  user_id uuid NOT NULL,  -- Added for querying by auth user
  organization_id uuid NOT NULL REFERENCES organizations(id),
  brokerage_id uuid REFERENCES brokerages(id),  -- NEW COLUMN
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

### 1. Database Migration

Created migration to add `brokerage_id` column to profiles table:

```sql
ALTER TABLE profiles ADD COLUMN brokerage_id uuid REFERENCES brokerages(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_profiles_brokerage_id ON profiles(brokerage_id);
```

### 2. Corrected Query Field (src/contexts/AuthContext.tsx)

Changed all profile queries to use `.eq('user_id', userId)`:

**Before:**
```typescript
.from('profiles')
.select('*')
.eq('id', userId)  // ❌ Wrong - should query by user_id
```

**After:**
```typescript
.from('profiles')
.select('*')
.eq('user_id', userId)  // ✅ Correct - query by user_id field
```

### 3. Updated Column References

Changed all references from `organization_id` to `brokerage_id`:

**Before:**
```typescript
if (!brokerProfileData.organization_id || !brokerProfileData.email) {
  const updatePayload = {
    organization_id: brokerage.id,
    email: userEmail || '',
    ...
  };
}
```

**After:**
```typescript
if (!brokerProfileData.brokerage_id || !brokerProfileData.email) {
  const updatePayload = {
    brokerage_id: brokerage.id,
    email: userEmail || '',
    ...
  };
}
```

### 4. Added Comprehensive Error Handling

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
    .eq('user_id', userId);

  if (updateErr) {
    console.error('❌ PROFILE UPDATE FAILED:', updateErr);
  }
}
```

### 5. Enhanced Logging

Added detailed logging throughout the profile update process:
- Current profile state before update
- Brokerage lookup results
- Update payload being sent
- Success/failure of each step
- Final profile state after reload

## Testing

### What to Test
1. **New client signup** on a subdomain (e.g., demo.claimsportal.co.za)
2. **Existing client login** with incomplete profile
3. **Console logs** should show:
   ```
   📝 Profile incomplete - updating with subdomain brokerage and user data
   ✓ Found brokerage for subdomain: demo → [brokerage-id]
   📤 Updating profile with: { brokerage_id: [...], email: [...], ... }
   ✓ Profile update successful
   ✓ Profile reloaded successfully: { brokerage_id: [...], email: [...], ... }
   ```

### Expected Outcome
- Client profile gets `brokerage_id` set to the brokerage's ID
- Client profile gets `email` and `full_name` populated
- Client can access the client portal without "Access Denied" errors

## Files Modified
1. `supabase/migrations/add_brokerage_id_to_profiles.sql` - Added brokerage_id column
2. `src/contexts/AuthContext.tsx` - Fixed all profile queries and column references
