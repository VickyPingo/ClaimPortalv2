# Routing Correction - Final Implementation

## Problem Statement
The previous implementation had inverted logic where `?broker=independi` signups were creating client profiles instead of broker profiles.

## Corrected Logic

### 1. Broker Invitation Link: ?broker=independi
**Purpose:** Allows brokers to sign up for Independi brokerage

**Key Point:** Users signing up via `?broker=independi` are BROKERS (not clients) and will be assigned role='staff' by default, giving them access to the Broker Dashboard.

**Implementation:**
- URL Parameter Detection (Login.tsx:211-215):
  ```typescript
  if (broker || brokerId) {
    setHasBrokerParam(true);
    setInvitationBrokerageName('Independi');
    setInvitationBrokerageId('10000000-0000-0000-0000-000000000001');
  }
  ```

- Signup Logic (Login.tsx:293-310):
  ```typescript
  // ALWAYS call brokerSignUp - no conditional logic
  await brokerSignUp(formData.email, formData.password, {
    full_name: formData.fullName,
    id_number: formData.idNumber,
    cell_number: formData.cellNumber,
    brokerage_id: invitationBrokerageId || undefined,
  });
  ```

**Database Result:**
- Creates entry in `broker_users` with role='staff'
- Creates entry in `broker_profiles` with role='staff' (default), user_type='broker'
- Links to Independi brokerage (10000000-0000-0000-0000-000000000001)

**Note:** Valid roles for broker_profiles are: 'super_admin', 'admin', 'agent', 'staff'

### 2. Dashboard Access Rules

#### Super Admin (vickypingo@gmail.com)
**Route:** BrokerAdminDashboard (Admin Dashboard)
**Access Level:** Everything - Brokerages, Users, Settings, All Claims

**Implementation:**
- Priority Email Check (HomePageRouter.tsx:47-53):
  ```typescript
  if (user.email === 'vickypingo@gmail.com') {
    console.log('👑 SUPER ADMIN EMAIL DETECTED');
    return <BrokerAdminDashboard />;
  }
  ```

- Role Guard (AuthContext.tsx:129-133):
  ```typescript
  const isUserSuperAdmin = isSuperAdmin(userEmail);
  if (isUserSuperAdmin) {
    console.log('🛡️ ROLE GUARD ACTIVATED');
  }
  ```

- Database Sync (AuthContext.tsx:165-178):
  - Automatically updates database if role !== 'super_admin'
  - Ensures database always reflects super_admin status

**Database:**
- broker_profiles.role = 'super_admin'
- broker_profiles.user_type = 'broker'

#### Regular Brokers (Independi Sign-ups)
**Route:** BrokerDashboard (Broker Dashboard)
**Access Level:** Their specific brokerage's claims and clients

**Implementation:**
- Broker Profile Check (HomePageRouter.tsx:99-108):
  ```typescript
  if (brokerProfile && brokerProfile.role !== 'super_admin') {
    console.log('✅ ROUTING TO: BrokerDashboard (Regular Broker)');
    return <BrokerDashboard />;
  }
  ```

**Database:**
- broker_profiles.role = 'staff' (or 'admin'/'agent' - any role except 'super_admin')
- broker_profiles.user_type = 'broker'
- broker_profiles.brokerage_id = '10000000-0000-0000-0000-000000000001' (Independi)

#### Clients
**Route:** ClientPortal (Client Portal)
**Access Level:** Their own claims only

**Implementation:**
- Client Profile Check (HomePageRouter.tsx:111-120):
  ```typescript
  if (clientProfile) {
    console.log('✅ ROUTING TO: ClientPortal (Client)');
    return <ClientPortal />;
  }
  ```

**Database:**
- client_profiles.role = 'client'
- client_profiles.user_type = 'client'

### 3. Routing Priority Order

The router checks in this exact order:
1. **Loading** → Show spinner
2. **Not Logged In** → Show login page
3. **Email = vickypingo@gmail.com** → BrokerAdminDashboard (Priority Override)
4. **Profile Loading** → Show spinner
5. **role = 'super_admin'** → BrokerAdminDashboard (Secondary Check)
6. **brokerProfile exists && role ≠ 'super_admin'** → BrokerDashboard
7. **clientProfile exists** → ClientPortal
8. **No Profile** → Error page with logout button

### 4. The Redirect Summary

| User Type | Email | Role | Dashboard | URL Path |
|-----------|-------|------|-----------|----------|
| Super Admin | vickypingo@gmail.com | super_admin | BrokerAdminDashboard | /admin-dashboard |
| Independi Broker | (any) | broker | BrokerDashboard | /broker-dashboard |
| Client | (any) | client | ClientPortal | /client-portal |

## Testing Scenarios

### Scenario 1: Super Admin Login
1. Navigate to any domain
2. Login as vickypingo@gmail.com
3. **Expected:** Immediate redirect to BrokerAdminDashboard
4. **Console Log:**
   ```
   👑 SUPER ADMIN EMAIL DETECTED: vickypingo@gmail.com
   ✅ ROUTING TO: BrokerAdminDashboard (Priority Override)
   ```

### Scenario 2: Broker Signup via ?broker=independi
1. Navigate to `https://[domain]/signup?broker=independi`
2. Fill out signup form with email, password, name, ID number, cell number
3. Submit signup
4. **Expected:**
   - Creates broker_profiles entry with role='broker'
   - Creates broker_users entry with role='staff'
   - Redirects to BrokerDashboard
5. **Console Log:**
   ```
   🟢 Signing up as BROKER
      Brokerage ID: 10000000-0000-0000-0000-000000000001
      Has broker param: true
   🟢 BROKER SIGNUP - Creating broker profile
   ✅ Broker profile created successfully
   ✅ ROUTING TO: BrokerDashboard (Regular Broker)
   ```

### Scenario 3: Broker Login (After Signup)
1. Login with broker credentials
2. **Expected:** Redirect to BrokerDashboard
3. **Console Log:**
   ```
   🔐 Starting broker sign in process...
   ✓ Broker authentication successful, fetching fresh profile from database...
   ✅ ROUTING TO: BrokerDashboard (Regular Broker)
   ```

## Database Verification

### Check Super Admin Setup
```sql
SELECT bp.id, bp.full_name, bp.role, bp.user_type, au.email
FROM broker_profiles bp
JOIN auth.users au ON au.id = bp.id
WHERE au.email = 'vickypingo@gmail.com';

-- Expected:
-- role: 'super_admin'
-- user_type: 'broker'
```

### Check Independi Broker Signups
```sql
SELECT bp.id, bp.full_name, bp.role, bp.user_type, bp.brokerage_id, au.email
FROM broker_profiles bp
JOIN auth.users au ON au.id = bp.id
WHERE bp.brokerage_id = '10000000-0000-0000-0000-000000000001'
  AND bp.role != 'super_admin';

-- Expected for each broker:
-- role: 'staff' (or 'admin'/'agent')
-- user_type: 'broker'
-- brokerage_id: '10000000-0000-0000-0000-000000000001'
```

### Check Broker Users Table
```sql
SELECT bu.id, bu.name, bu.role, bu.brokerage_id, au.email
FROM broker_users bu
JOIN auth.users au ON au.id = bu.id
WHERE bu.brokerage_id = '10000000-0000-0000-0000-000000000001';

-- Expected for each broker:
-- role: 'staff' (in broker_users table)
```

## Files Modified

1. **src/components/Login.tsx**
   - Line 183: Removed clientSignUp import (not needed for ?broker=independi)
   - Lines 211-215: Detect ?broker or ?brokerId parameter
   - Lines 293-310: Always call brokerSignUp (removed client signup logic)

2. **src/contexts/AuthContext.tsx**
   - Lines 304-359: brokerSignUp() creates broker_profiles with role='broker'
   - Lines 128-133: Role guard checks SUPER_ADMINS list
   - Lines 165-178: Database sync for super_admin role

3. **src/components/HomePageRouter.tsx**
   - Lines 47-53: Priority email check for vickypingo@gmail.com
   - Lines 83-96: Secondary role check for super_admin
   - Lines 99-108: Broker routing (role ≠ super_admin)
   - Lines 111-120: Client routing

4. **src/config/roles.ts**
   - Maintains SUPER_ADMINS list
   - Contains isSuperAdmin() helper function

## Critical Points

✅ **DO** use ?broker=independi to sign up brokers
✅ **DO** expect brokers to see BrokerDashboard
✅ **DO** expect vickypingo@gmail.com to see BrokerAdminDashboard
✅ **DO** verify role field in database matches expected value

🔴 **DO NOT** expect ?broker=independi to create client profiles
🔴 **DO NOT** call clientSignUp() for broker signups
🔴 **DO NOT** confuse broker_users.role with broker_profiles.role

## Working URLs

1. **Super Admin Login:** Any domain, login as vickypingo@gmail.com
2. **Broker Signup:** `https://[domain]/signup?broker=independi`
3. **Broker Signup (Alt):** `https://[domain]/signup?brokerId=independi`
4. **Client Signup:** Requires separate invitation or signup flow (not via ?broker parameter)

## Role Field Locations

| Table | Field | Value for Independi Brokers | Value for Super Admin |
|-------|-------|----------------------------|----------------------|
| broker_users | role | 'staff' | 'staff' or 'super_admin' |
| broker_profiles | role | 'staff' (default) | 'super_admin' |
| broker_profiles | user_type | 'broker' | 'broker' |
| client_profiles | role | 'client' | N/A |
| client_profiles | user_type | 'client' | N/A |

**Important:** The routing logic checks `broker_profiles.role` field, NOT `broker_users.role`.

**Valid broker_profiles.role values:** 'super_admin', 'admin', 'agent', 'staff'

**Routing Rules:**
- role = 'super_admin' → BrokerAdminDashboard
- role = 'admin' OR 'agent' OR 'staff' → BrokerDashboard
