# Super Admin - Quick Reference

## What Was Implemented

Role-based authorization and routing system with a special "super_admin" role that controls access to admin features and automatically redirects to the brokerages management dashboard upon login.

## How It Works

**Authorization Check:**
```typescript
const { isSuperAdmin } = useAuth();

if (isSuperAdmin()) {
  // User has super admin privileges
}
```

**Automatic Routing:**
- Super admins are automatically redirected to `/admin/brokerages` upon login
- Regular brokers see the standard broker dashboard
- Clients see the client portal

**Protected Features:**
- Brokerages menu item (only visible to super admins)
- Admin Settings menu item (only visible to super admins)
- Brokerages page access (redirects non-admins with "Access Denied" message)
- Settings page access (redirects non-admins with "Access Denied" message)

## Creating a Super Admin

**Method 1: Update Existing User**
```sql
UPDATE broker_profiles
SET role = 'super_admin'
WHERE id = 'user-uuid-here';
```

**Method 2: Find by Email**
```sql
UPDATE broker_profiles
SET role = 'super_admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'admin@example.com'
);
```

## Login Routing Behavior

**Super Admin Login Flow:**
1. User logs in with super_admin role
2. AuthGate detects super admin status
3. Automatically shows BrokerAdminDashboard
4. BrokerAdminDashboard automatically sets view to 'brokerages'
5. User sees Brokerages Management page immediately

**Regular Broker Login Flow:**
1. User logs in with 'staff' or null role
2. AuthGate shows standard BrokerDashboard
3. User can optionally click "Admin" to access BrokerAdminDashboard
4. BrokerAdminDashboard shows 'dashboard' view by default

**Client Login Flow:**
1. User logs in as client
2. AuthGate shows ClientPortal
3. No access to admin features

## Navigation Menu Visibility

**Super Admin Sees:**
- Dashboard
- Inbox (All Claims)
- Clients Directory
- Brokerages (NEW)
- Admin Settings

**Regular Broker Sees:**
- Dashboard
- Inbox (All Claims)
- Clients Directory

## Testing

**As Super Admin:**
1. Set user role to 'super_admin' in database
2. Sign out and sign back in
3. **VERIFY:** Automatically redirected to Brokerages page
4. **VERIFY:** "Brokerages" and "Admin Settings" appear in sidebar
5. Can navigate to all sections without errors

**As Regular User:**
1. Set user role to 'staff' (or null)
2. Sign out and sign back in
3. **VERIFY:** See standard broker dashboard
4. **VERIFY:** "Brokerages" and "Admin Settings" menus are hidden
5. Try typing `/admin` URL directly - should see "Access Denied"

## Access Denied Behavior

**Attempting to Access Protected Routes:**
- Toast notification appears at top
- Message: "Access Denied: Only super administrators can access this section"
- Auto-dismisses after 5 seconds
- User stays on current page

**Direct URL Access:**
- Redirects to dashboard
- Shows access denied message
- Settings page doesn't render

## Using in Components

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { isSuperAdmin } = useAuth();

  return (
    <div>
      {isSuperAdmin() && (
        <button>Admin Only Feature</button>
      )}
    </div>
  );
}
```

## Valid Role Values

- `super_admin` - Full platform access
- `staff` - Regular broker access (default)
- `client` - Client portal access
- `null` - Treated as staff

## Troubleshooting

**Settings menu not showing:**
- Check role is exactly 'super_admin' (case-sensitive)
- Log out and log back in
- Clear browser cache

**Non-admins can access settings:**
- Verify isSuperAdmin() implementation
- Check role is being loaded from database
- Ensure user logged out/in after role change

**Role not updating:**
- Changes require logout/login
- Check correct profile table updated (broker_profiles vs client_profiles)
- Verify no caching issues

## Files Modified

1. **AuthContext.tsx**
   - Added `userRole` state
   - Added `isSuperAdmin()` helper
   - Updated profile interfaces with `role` field

2. **AuthGate.tsx**
   - Automatically detects super admin on login
   - Sets `showAdminDashboard` to true for super admins
   - Implements role-based routing logic

3. **AdminLayout.tsx**
   - Added "Brokerages" navigation item for super admins
   - Conditionally shows "Admin Settings" menu
   - Uses `isSuperAdmin()` to filter navigation items

4. **BrokerAdminDashboard.tsx**
   - Defaults to 'brokerages' view for super admins
   - Blocks navigation to protected routes for non-admins
   - Shows access denied alerts
   - Redirects unauthorized access
   - Renders BrokeragesManager component

5. **BrokeragesManager.tsx** (NEW)
   - Displays all brokerages in the system
   - Search and filter functionality
   - Brokerage management interface
   - Super admin only component

## Quick Commands

**Promote user to super admin:**
```sql
-- Using email
UPDATE broker_profiles
SET role = 'super_admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'user@example.com');
```

**Demote super admin:**
```sql
UPDATE broker_profiles
SET role = 'staff'
WHERE id = (SELECT id FROM auth.users WHERE email = 'user@example.com');
```

**Check all super admins:**
```sql
SELECT bp.full_name, u.email, bp.role
FROM broker_profiles bp
JOIN auth.users u ON u.id = bp.id
WHERE bp.role = 'super_admin';
```

## Security Notes

**Multiple Protection Layers:**
1. UI - Menu items hidden
2. Navigation - Blocked with alerts
3. Routes - Page renders access denied
4. Database - RLS policies (if implemented)

**Best Practices:**
- Limit super admin accounts to trusted users only
- Always use `isSuperAdmin()` for checks
- Don't expose admin features without proper auth
- Consider implementing audit logs

## Documentation

See **SUPER_ADMIN_AUTHORIZATION.md** for:
- Detailed implementation guide
- Security considerations
- Testing procedures
- Future enhancements
- Troubleshooting guide
