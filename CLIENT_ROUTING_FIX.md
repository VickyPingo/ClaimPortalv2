# Client Routing Fix - Complete

## Problem
Clients with `role='client'` in the profiles table were being routed to `/broker-dashboard` and seeing "Access Denied" instead of being immediately redirected to their claims portal.

## Root Cause
The routing logic in HomePageRouter.tsx was checking broker routing conditions before client routing, allowing clients to briefly access the BrokerAdminDashboard component before being blocked.

## Solution

### 1. AuthContext Profile Loading (Already Working)
The AuthContext correctly identifies clients and sets:
- `userType = 'client'`
- `userRole = 'client'`
- `brokerageId = profile.brokerage_id`

Located in `src/contexts/AuthContext.tsx:440-456`

### 2. HomePageRouter.tsx - Route Priority Changes

**Changed route priority order:**

```typescript
// BEFORE: Broker routing came before client routing
if (userType === 'broker') { ... }
else if (userType === 'client') { ... }

// AFTER: Client routing comes before broker routing
if (userType === 'client' || userRole === 'client') {
  console.log('✅ ROUTING TO: /claims-portal (userType: client, userRole: client)');
  return <ClientPortal />;
}
else if ((userType === 'broker' || userRole === 'broker') && userRole !== 'client') {
  console.log('✅ ROUTING TO: /broker-dashboard (userType: broker)');
  return <BrokerAdminDashboard />;
}
```

**Added client path blocking in useEffect:**

```typescript
// Block clients from accessing broker/admin routes
const clientRestrictedPaths = ['/broker-dashboard', '/admin-dashboard', '/organisations', '/users-management', '/invitations', '/admin-settings'];

if (isClientRestrictedPath && (userRole === 'client' || userType === 'client')) {
  console.log('❌ CLIENT ATTEMPTING TO ACCESS RESTRICTED PATH:', currentPath);
  console.log('  Redirecting to claims portal');
  window.history.replaceState(null, '', '/claims-portal');
  return;
}
```

**Improved early client blocking:**

```typescript
// STEP 2: Check if client is trying to access broker/admin routes
if ((currentPath === '/broker-dashboard' || currentPath === '/admin-dashboard') &&
    (userType === 'client' || userRole === 'client')) {
  console.log('❌ CLIENT TRYING TO ACCESS RESTRICTED ROUTE - REDIRECTING TO CLAIMS PORTAL');
  window.location.href = '/claims-portal';
  return null;
}
```

### 3. BrokerAdminDashboard.tsx - Component Guard

Added immediate redirect guard at the top of the component:

```typescript
export default function BrokerAdminDashboard() {
  const { isSuperAdmin, userRole, user, userType } = useAuth();

  // CRITICAL: Block clients from accessing broker dashboard
  if (userRole === 'client' || userType === 'client') {
    console.log('❌ CLIENT BLOCKED FROM BROKER DASHBOARD - REDIRECTING TO CLAIMS PORTAL');
    window.location.href = '/claims-portal';
    return null;
  }

  // ... rest of component
}
```

## Multiple Layers of Protection

1. **useEffect redirect** - Detects client on wrong path and redirects
2. **STEP 2 guard** - Blocks clients from /broker-dashboard and /admin-dashboard paths
3. **Rendering priority** - Clients are rendered with ClientPortal before broker logic
4. **Component guard** - BrokerAdminDashboard immediately redirects clients
5. **Broker routing exclusion** - Broker routing explicitly excludes `userRole === 'client'`

## Expected Behavior

### Client Login Flow:
1. Client logs in with email/password
2. AuthContext loads profile from `profiles` table
3. Profile has `role='client'` and `brokerage_id` set
4. AuthContext sets `userType='client'`, `userRole='client'`, `brokerageId=profile.brokerage_id`
5. HomePageRouter detects client role
6. **Client is immediately routed to /claims-portal**
7. ClientPortal component renders
8. Client never sees BrokerAdminDashboard or "Access Denied"

### Broker Login Flow:
1. Broker logs in with email/password
2. AuthContext loads profile from `profiles` table
3. Profile has `role='broker'` or `role='main_broker'`
4. AuthContext sets `userType='broker'`, `userRole=profile.role`, `brokerageId=profile.brokerage_id`
5. HomePageRouter detects broker role
6. Broker is routed to /broker-dashboard
7. BrokerAdminDashboard component renders
8. Broker sees their dashboard

### Client Protection:
- If client tries to navigate to `/broker-dashboard`, they are immediately redirected to `/claims-portal`
- If client somehow reaches BrokerAdminDashboard component, they are immediately redirected
- Multiple guards ensure clients never see broker-only content

## Files Modified
1. `src/components/HomePageRouter.tsx`
   - Reordered routing priority (client before broker)
   - Added client path blocking in useEffect
   - Improved STEP 2 client guard with immediate redirect
   - Updated route determination logic

2. `src/components/admin/BrokerAdminDashboard.tsx`
   - Added client blocking guard at component entry
   - Added `userType` to useAuth destructuring

## Testing

### Test Case 1: Client Signup/Login
1. Sign up as client on a brokerage subdomain
2. Verify profile is created with `role='client'` and `brokerage_id` set
3. Verify redirect to `/claims-portal`
4. Verify ClientPortal component renders
5. Check console logs show "✅ ROUTING TO: /claims-portal"

### Test Case 2: Client Attempts Broker Access
1. Log in as client
2. Manually navigate to `/broker-dashboard`
3. Verify immediate redirect to `/claims-portal`
4. Check console logs show "❌ CLIENT ATTEMPTING TO ACCESS RESTRICTED PATH"

### Test Case 3: Broker Login
1. Log in as broker
2. Verify redirect to `/broker-dashboard`
3. Verify BrokerAdminDashboard renders
4. Verify no client-related redirects occur

### Test Case 4: Super Admin Login
1. Log in as super admin
2. Verify access to all admin features
3. Verify no client-related redirects occur

## Console Logging

The fix includes comprehensive logging:
- AuthContext logs role and type assignment
- HomePageRouter logs routing decisions
- BrokerAdminDashboard logs access attempts
- All redirects are logged with clear reasons

Look for these patterns:
- `✅ ROUTING TO: /claims-portal (userType: client, userRole: client)` - Successful client routing
- `❌ CLIENT ATTEMPTING TO ACCESS RESTRICTED PATH` - Client blocked from wrong path
- `❌ CLIENT BLOCKED FROM BROKER DASHBOARD` - Client blocked at component level
