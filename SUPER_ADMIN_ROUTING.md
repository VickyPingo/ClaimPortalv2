# Super Admin Role-Based Routing

## Overview

The application now implements intelligent role-based routing that automatically directs users to the appropriate dashboard based on their role immediately after login.

## Routing Behavior

### Super Admin Users (role = 'super_admin')

**Login Flow:**
```
1. User logs in
2. AuthContext fetches user profile and role
3. AuthGate detects isSuperAdmin() === true
4. Automatically sets showAdminDashboard = true
5. BrokerAdminDashboard renders
6. BrokerAdminDashboard detects super admin
7. Sets initial view to 'brokerages'
8. User sees Brokerages Management page
```

**Result:** Super admins land directly on `/admin/brokerages` (Brokerages Management)

### Regular Broker Users (role = 'staff' or null)

**Login Flow:**
```
1. User logs in
2. AuthContext fetches user profile and role
3. AuthGate detects isSuperAdmin() === false
4. Shows BrokerDashboard (standard dashboard)
5. User can optionally navigate to admin features
```

**Result:** Regular brokers land on the standard broker dashboard with claims

### Client Users

**Login Flow:**
```
1. User logs in
2. AuthContext fetches user profile
3. AuthGate detects userType === 'client'
4. Shows ClientPortal
```

**Result:** Clients land on their client portal

## Implementation Details

### AuthGate Component

```typescript
// Automatic detection and routing for super admins
useEffect(() => {
  if (user && userType === 'broker' && isSuperAdmin()) {
    setShowAdminDashboard(true);
  }
}, [user, userType, isSuperAdmin]);
```

This effect runs whenever the user, userType, or role changes, ensuring super admins always see the admin dashboard.

### BrokerAdminDashboard Component

```typescript
// Set initial view based on role
const [currentView, setCurrentView] = useState<View>(
  isSuperAdmin() ? 'brokerages' : 'dashboard'
);
```

The dashboard intelligently sets its initial view:
- Super admins start on 'brokerages'
- Regular users (if they access this) start on 'dashboard'

### Route Protection

**Multi-Layer Protection:**

1. **Navigation Layer:**
```typescript
const handleNavigate = (view) => {
  if ((view === 'settings' || view === 'brokerages') && !isSuperAdmin()) {
    setAccessDeniedMessage('Access Denied');
    return; // Block navigation
  }
  setCurrentView(view);
};
```

2. **Render Layer:**
```typescript
case 'brokerages':
  return isSuperAdmin() ? (
    <BrokeragesManager />
  ) : (
    <AccessDeniedPage />
  );
```

3. **Mount Protection:**
```typescript
useEffect(() => {
  if ((currentView === 'settings' || currentView === 'brokerages') && !isSuperAdmin()) {
    setCurrentView('dashboard');
    setAccessDeniedMessage('Access Denied');
  }
}, [currentView, isSuperAdmin]);
```

## Navigation Menu Structure

### Super Admin Menu
```
├── Dashboard
├── Inbox (All Claims)
├── Clients Directory
├── Brokerages           ← Super admin only
└── Admin Settings       ← Super admin only
```

### Regular Broker Menu
```
├── Dashboard
├── Inbox (All Claims)
└── Clients Directory
```

The menu items are dynamically generated using `useMemo`:

```typescript
const navItems = useMemo(() => {
  const baseItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'inbox', icon: Inbox, label: 'Inbox (All Claims)' },
    { id: 'clients', icon: Users, label: 'Clients Directory' },
  ];

  if (isSuperAdmin()) {
    baseItems.push({ id: 'brokerages', icon: Building2, label: 'Brokerages' });
    baseItems.push({ id: 'settings', icon: Settings, label: 'Admin Settings' });
  }

  return baseItems;
}, [isSuperAdmin]);
```

## Direct URL Access Handling

### Scenario: Non-admin tries to access `/admin` directly

**What Happens:**
1. User types URL in browser
2. BrokerAdminDashboard mounts
3. useEffect detects unauthorized access
4. Redirects to 'dashboard' view
5. Shows access denied toast notification
6. Message auto-dismisses after 5 seconds

**Code:**
```typescript
useEffect(() => {
  if ((currentView === 'settings' || currentView === 'brokerages') && !isSuperAdmin()) {
    setCurrentView('dashboard');
    setAccessDeniedMessage('Access Denied: You do not have permission...');
    setTimeout(() => setAccessDeniedMessage(null), 5000);
  }
}, [currentView, isSuperAdmin]);
```

## Access Denied UX

### Toast Notification
- Appears at top center of screen
- Red alert box with shield icon
- Clear message explaining the restriction
- Auto-dismisses after 5 seconds
- Can be manually closed by user

### Full-Page Block
If somehow the protected view renders:
- Large centered card with shield icon
- "Access Denied" heading
- Explanation text
- "Return to Dashboard" button
- No access to underlying content

## Testing the Routing

### Test Super Admin Login

**Setup:**
```sql
UPDATE broker_profiles
SET role = 'super_admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
```

**Test Steps:**
1. Sign out completely
2. Sign in with admin@example.com
3. **EXPECT:** Immediately see Brokerages Management page
4. **VERIFY:** URL shows admin interface
5. **VERIFY:** Sidebar shows "Brokerages" and "Admin Settings"

### Test Regular Broker Login

**Setup:**
```sql
UPDATE broker_profiles
SET role = 'staff'
WHERE id = (SELECT id FROM auth.users WHERE email = 'broker@example.com');
```

**Test Steps:**
1. Sign out completely
2. Sign in with broker@example.com
3. **EXPECT:** See standard broker dashboard with claims
4. **VERIFY:** Sidebar does NOT show "Brokerages" or "Admin Settings"
5. Try manually navigating to admin URL
6. **EXPECT:** Access denied message and redirect

### Test Direct URL Access

**As Regular User:**
1. While logged in as regular broker
2. Manually type in browser: `yourdomain.com/admin`
3. **EXPECT:**
   - Red toast notification appears
   - Message: "Access Denied"
   - Redirected to dashboard view
   - No access to admin features

## Role Changes and Session Management

### When Role is Changed in Database

**Important:** Users must log out and log back in for role changes to take effect.

**Why:** The role is fetched during authentication and stored in AuthContext state. Changes to the database don't automatically update the active session.

**Process:**
```
1. Admin updates role in database
2. User logs out (clears AuthContext state)
3. User logs back in
4. AuthContext fetches updated role
5. Routing applies new role logic
```

### Force Role Refresh (if needed)

If you need to implement a role refresh without logout:

```typescript
// In AuthContext, add:
const refreshUserRole = async () => {
  if (user) {
    await determineUserType(user.id);
  }
};

// Then call it when needed:
await refreshUserRole();
```

## Security Considerations

### Multiple Protection Layers

1. **UI Layer:** Menu items hidden for non-admins
2. **Navigation Layer:** Navigation attempts blocked
3. **Render Layer:** Protected components check role before rendering
4. **Mount Layer:** useEffect redirects unauthorized access
5. **Database Layer:** RLS policies (if implemented)

### Best Practices

**Never rely on UI hiding alone:**
```typescript
// BAD
{isSuperAdmin() && <AdminButton />}

// GOOD
{isSuperAdmin() && <AdminButton />}
// PLUS
const handleAdminAction = () => {
  if (!isSuperAdmin()) {
    showAccessDenied();
    return;
  }
  // Perform action
};
```

**Always validate on server:**
- Client-side checks are for UX only
- Server/database must also validate permissions
- Use RLS policies in Supabase
- Verify role in edge functions

## Troubleshooting

### Super admin not redirecting to brokerages

**Check:**
1. Role is exactly 'super_admin' (case-sensitive)
2. User has logged out and back in
3. Browser cache cleared
4. Profile table has role field populated
5. AuthContext is providing isSuperAdmin correctly

**Debug:**
```typescript
// Add to AuthGate
console.log('User:', user?.id);
console.log('User Type:', userType);
console.log('Is Super Admin:', isSuperAdmin());
console.log('Show Admin Dashboard:', showAdminDashboard);
```

### Regular user can access admin features

**Check:**
1. isSuperAdmin() is returning correct value
2. Role is not 'super_admin' in database
3. Navigation protection is in place
4. useEffect is running correctly

**Debug:**
```typescript
// Add to BrokerAdminDashboard
console.log('Current View:', currentView);
console.log('Is Super Admin:', isSuperAdmin());
console.log('User Role:', userRole);
```

### Routes not updating after role change

**Solution:**
1. User must log out
2. Clear browser storage (if needed)
3. Log back in
4. Role will be freshly fetched

## API Reference

### useAuth Hook

```typescript
const {
  user,              // Current user object
  userType,          // 'broker' | 'client' | null
  userRole,          // Role string from database
  isSuperAdmin,      // Function: () => boolean
} = useAuth();
```

### isSuperAdmin Function

```typescript
// Returns true if userRole === 'super_admin'
const isAdmin = isSuperAdmin();

if (isAdmin) {
  // Show admin features
}
```

### View Types

```typescript
type View =
  | 'dashboard'      // Main dashboard
  | 'inbox'          // All claims inbox
  | 'clients'        // Clients directory
  | 'brokerages'     // Brokerages management (super admin)
  | 'settings'       // Admin settings (super admin)
  | 'client-folder'  // Individual client view
  | 'claim-view';    // Individual claim view
```

## Future Enhancements

### Custom Routes
Consider implementing proper URL routing:
```typescript
import { BrowserRouter, Route, Routes } from 'react-router-dom';

<Routes>
  <Route path="/admin/brokerages" element={<ProtectedRoute><BrokeragesManager /></ProtectedRoute>} />
  <Route path="/admin/settings" element={<ProtectedRoute><SettingsPanel /></ProtectedRoute>} />
</Routes>
```

### Deep Linking
Allow direct links to specific claims or clients:
```
/admin/clients/:clientId
/admin/claims/:claimId
/admin/brokerages/:brokerageId
```

### Role Hierarchy
Implement more granular roles:
```typescript
const roleHierarchy = {
  'super_admin': 100,
  'admin': 50,
  'manager': 25,
  'staff': 10,
  'viewer': 5,
};

const hasPermission = (required: string) => {
  return roleHierarchy[userRole] >= roleHierarchy[required];
};
```

## Summary

The routing system provides:
- Automatic role-based navigation on login
- Super admins land on Brokerages Management
- Regular users see appropriate dashboards
- Multiple layers of route protection
- Clear access denied messaging
- Secure, user-friendly experience

Super admins are seamlessly directed to the Brokerages Management interface, while regular users maintain access to their standard dashboards with appropriate restrictions in place.
