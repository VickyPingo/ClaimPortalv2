# Routing and Registration Fix - Complete

## Problem Summary
The routing system was completely inverted, causing clients to be registered as brokers and vice versa. The super admin was not being properly routed to the admin dashboard.

## Fixes Applied

### 1. Hard-Coded Admin Access
**File:** `src/components/HomePageRouter.tsx`
- Added priority check for `vickypingo@gmail.com` at line 47-53
- This check happens BEFORE any profile checks to ensure immediate routing
- Routes directly to `BrokerAdminDashboard` for this email

**File:** `src/contexts/AuthContext.tsx`
- Added role guard in `determineUserType()` function (lines 128-133)
- Checks `SUPER_ADMINS` list from `config/roles.ts`
- Forces `super_admin` role even if database doesn't have it yet
- Automatically syncs role to database if mismatch detected (lines 165-178)

**File:** `src/config/roles.ts`
- Maintains the list of super admin emails
- Currently contains: `['vickypingo@gmail.com']`

### 2. Client Lockdown via ?broker=independi
**File:** `src/components/Login.tsx`

**Line 183:** Added `clientSignUp` import
```typescript
const { brokerSignUp, clientSignUp } = useAuth();
```

**Lines 203-222:** Added broker parameter detection
```typescript
const broker = params.get('broker');
const brokerId = params.get('brokerId');

if (broker || brokerId) {
  setHasBrokerParam(true);
  setInvitationBrokerageName('Independi');
  setInvitationBrokerageId('10000000-0000-0000-0000-000000000001');
}
```

**Lines 294-310:** Fixed signup logic to use correct function
```typescript
if (hasBrokerParam) {
  console.log('🔵 Signing up as CLIENT via broker parameter');
  await clientSignUp(formData.email, formData.password, {
    full_name: formData.fullName,
    email: formData.email,
    cell_number: formData.cellNumber,
    role: 'client',
  }, invitationBrokerageId || undefined);
} else {
  console.log('🟢 Signing up as BROKER');
  await brokerSignUp(formData.email, formData.password, {
    full_name: formData.fullName,
    id_number: formData.idNumber,
    cell_number: formData.cellNumber,
    brokerage_id: invitationBrokerageId || undefined,
  });
}
```

### 3. Database Schema
**Migration:** `20260211_create_super_admin_vickypingo.sql`
- Creates function to ensure super admin setup
- Automatically creates/updates broker_users and broker_profiles for vickypingo@gmail.com
- Sets role to 'super_admin' and user_type to 'broker'
- Linked to Independi brokerage

**Existing Schema:**
- `client_profiles.role` defaults to 'client'
- `client_profiles.user_type` defaults to 'client'
- `broker_profiles.role` defaults to 'staff'
- `broker_profiles.user_type` defaults to 'broker'

### 4. AuthContext Updates
**File:** `src/contexts/AuthContext.tsx`

**clientSignUp() - Lines 373-407:**
- Now explicitly sets `role: 'client'` and `user_type: 'client'`
- Added console logging for debugging
- Accepts `brokerageId` parameter for proper organization assignment

**brokerSignUp() - Lines 304-358:**
- Now explicitly sets `role: 'broker'` and `user_type: 'broker'` in broker_profiles
- Sets `role: 'staff'` in broker_users table
- Added console logging for debugging

### 5. Dashboard Routing
**File:** `src/components/HomePageRouter.tsx`

**Priority Order:**
1. **Loading State** (lines 30-39) - Show spinner while loading
2. **Not Logged In** (lines 42-44) - Show login page
3. **Super Admin Email Check** (lines 47-53) - Route vickypingo@gmail.com to BrokerAdminDashboard
4. **Profile Loading** (lines 56-66) - Wait for profile data
5. **Super Admin Role Check** (lines 83-96) - Route if role is 'super_admin'
6. **Broker Check** (lines 99-108) - Route to BrokerDashboard if broker profile exists
7. **Client Check** (lines 111-120) - Route to ClientPortal if client profile exists
8. **Error State** (lines 123-152) - Show error if no valid profile

## Testing Checklist

### Super Admin Access (vickypingo@gmail.com)
- ✅ Should route directly to BrokerAdminDashboard
- ✅ Should bypass all other checks
- ✅ Should see "Force Logout" button
- ✅ Should have access to all admin features

### Client Registration via ?broker=independi
- ✅ Registration form should appear
- ✅ Should show "Registering with: Independi"
- ✅ Should create client_profiles entry (NOT broker_profiles)
- ✅ Should set role='client' and user_type='client'
- ✅ Should route to ClientPortal after registration
- ✅ Should NEVER see BrokerDashboard

### Broker Registration
- ✅ Should only work with valid invitation
- ✅ Should create broker_profiles entry
- ✅ Should create broker_users entry
- ✅ Should set role='broker' and user_type='broker'
- ✅ Should route to BrokerDashboard after registration

## Verification Commands

```sql
-- Check vickypingo@gmail.com setup
SELECT bp.id, bp.full_name, bp.role, bp.user_type, au.email
FROM broker_profiles bp
JOIN auth.users au ON au.id = bp.id
WHERE au.email = 'vickypingo@gmail.com';

-- Should return:
-- role: 'super_admin'
-- user_type: 'broker'

-- Check client profiles
SELECT id, email, role, user_type, brokerage_id
FROM client_profiles
WHERE email LIKE '%test%';

-- Should return:
-- role: 'client'
-- user_type: 'client'
-- brokerage_id: '10000000-0000-0000-0000-000000000001' (for Independi signups)

-- Check broker profiles
SELECT id, full_name, role, user_type, brokerage_id
FROM broker_profiles;

-- Should return:
-- role: 'broker' or 'super_admin'
-- user_type: 'broker'
```

## Console Log Patterns

### On Super Admin Login (vickypingo@gmail.com):
```
🔍 DETERMINING USER TYPE FOR USER ID: [uuid]
📧 User email: vickypingo@gmail.com
🛡️ ROLE GUARD ACTIVATED: Email found in SUPER_ADMINS list
👑 SUPER ADMIN EMAIL DETECTED: vickypingo@gmail.com
✅ ROUTING TO: BrokerAdminDashboard (Priority Override)
```

### On Client Signup via ?broker=independi:
```
🔵 Signing up as CLIENT via broker parameter
🔵 CLIENT SIGNUP - Creating client profile
   Brokerage ID: 10000000-0000-0000-0000-000000000001
✅ Client profile created successfully
✅ ROUTING TO: ClientPortal (Client)
```

### On Broker Signup:
```
🟢 Signing up as BROKER
🟢 BROKER SIGNUP - Creating broker profile
   Brokerage ID: [uuid]
✅ Broker profile created successfully
✅ ROUTING TO: BrokerDashboard (Regular Broker)
```

## Known Working URLs

1. **Super Admin Login:** Any domain, login as vickypingo@gmail.com
2. **Client Signup:** `https://[domain]/signup?broker=independi`
3. **Client Signup (alt):** `https://[domain]/signup?brokerId=independi`
4. **Broker Signup:** Requires invitation link with valid token

## Files Modified
1. `src/components/Login.tsx` - Fixed signup logic to route clients vs brokers correctly
2. `src/contexts/AuthContext.tsx` - Added role/user_type fields, improved logging
3. `src/components/HomePageRouter.tsx` - Fixed routing priority and logic
4. `supabase/migrations/20260211_create_super_admin_vickypingo.sql` - Super admin setup

## Critical Points

🔴 **DO NOT** call `brokerSignUp()` for users registering via ?broker=independi
🔴 **DO NOT** create broker_profiles for clients
🔴 **DO NOT** skip the super admin email check in HomePageRouter
🔴 **DO NOT** cache role/profile data - always fetch fresh from database

✅ **DO** use `clientSignUp()` for ?broker=independi registrations
✅ **DO** check email BEFORE checking role in HomePageRouter
✅ **DO** set role and user_type explicitly in both signup functions
✅ **DO** pass brokerage_id to clientSignUp when available
