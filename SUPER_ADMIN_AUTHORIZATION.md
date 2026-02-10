# Super Admin Authorization

## Overview

The application now includes role-based access control with a special "super_admin" role that grants elevated permissions for platform administration.

## Implementation Details

### Database Schema

A `role` column has been added to both profile tables:
- `broker_profiles.role` - Stores the role for broker users
- `client_profiles.role` - Stores the role for client users

**Valid Roles:**
- `super_admin` - Full platform access, can manage all brokerages and settings
- `staff` - Regular broker/employee access
- `client` - Client portal access
- `null` - Default user (same as staff)

### Authentication Context Updates

**New Fields:**
- `userRole: string | null` - The current user's role
- `isSuperAdmin(): boolean` - Helper function to check if user is super admin

**Updated Interfaces:**
```typescript
export interface BrokerProfile {
  // ... existing fields
  role?: string;
}

export interface ClientProfile {
  // ... existing fields
  role?: string;
}
```

### Using Super Admin Check

**In Components:**
```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { isSuperAdmin, userRole } = useAuth();

  if (isSuperAdmin()) {
    // Show super admin features
  }

  return (
    <div>
      {isSuperAdmin() && <AdminPanel />}
    </div>
  );
}
```

## Features Protected by Super Admin Role

### 1. Navigation Items

**Admin Settings Menu:**
- Only visible to super admins
- Located in the sidebar of BrokerAdminDashboard
- Regular users don't see this menu item at all

### 2. Route Protection

**Settings Page:**
- URL: `/admin/settings` (accessed via the settings navigation)
- Protected at multiple levels:
  - Navigation is hidden for non-super-admins
  - Direct access attempts are blocked
  - Shows "Access Denied" message

**Protection Flow:**
```
User clicks Settings
  → Check if super admin
  → If NO: Show access denied alert + stay on current page
  → If YES: Navigate to settings page

User tries direct URL access
  → useEffect checks role on mount
  → If not super admin: Redirect to dashboard + show message
  → If super admin: Show settings page
```

### 3. Access Denied Messaging

**Toast Notification:**
- Appears at the top center of the screen
- Red background with shield icon
- Auto-dismisses after 5 seconds
- Can be manually closed

**Full Page Block:**
- Shown if somehow user reaches settings page
- Large centered card with shield icon
- "Return to Dashboard" button
- Prevents any interaction with protected content

## Creating Super Admin Users

### Option 1: Direct Database Update

Update an existing user's profile:

```sql
-- For broker users
UPDATE broker_profiles
SET role = 'super_admin'
WHERE id = 'user-uuid-here';

-- For client users (if needed)
UPDATE client_profiles
SET role = 'super_admin'
WHERE id = 'user-uuid-here';
```

### Option 2: During Signup

When creating a new user through the admin panel or invitation system, set the role field to 'super_admin'.

### Option 3: Via Admin Interface

Super admins can update other users' roles through the Settings panel (if role management UI is added).

## Security Considerations

### Multiple Layers of Protection

1. **UI Layer**: Menu items hidden
2. **Navigation Layer**: Navigation blocked with alerts
3. **Route Layer**: Page renders access denied
4. **Database Layer**: RLS policies (implement if needed)

### Best Practices

**Do:**
- Always check `isSuperAdmin()` before showing sensitive UI
- Implement server-side validation for critical operations
- Log super admin actions for audit trails
- Limit number of super admin accounts

**Don't:**
- Don't rely solely on UI hiding for security
- Don't expose super admin features in production without proper auth
- Don't hard-code admin emails/IDs in the frontend

## Testing Super Admin Features

### Test as Super Admin

1. **Grant super admin role:**
```sql
UPDATE broker_profiles
SET role = 'super_admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```

2. **Sign in and verify:**
- Settings menu should appear in sidebar
- Can access settings page
- No access denied messages

### Test as Regular User

1. **Ensure regular role:**
```sql
UPDATE broker_profiles
SET role = 'staff'
WHERE id = (SELECT id FROM auth.users WHERE email = 'regular@email.com');
```

2. **Sign in and verify:**
- Settings menu is hidden
- Attempting to navigate to settings shows access denied
- Gets redirected to dashboard

### Test Direct URL Access

1. **As regular user, type in browser:**
   ```
   https://yourdomain.com/admin
   ```

2. **Expected behavior:**
   - Access denied message appears
   - Redirected back to dashboard
   - Settings page does not render

## Troubleshooting

### "Settings menu not appearing for super admin"

**Check:**
- User's role is exactly 'super_admin' (case-sensitive)
- Profile table has been updated (broker_profiles or client_profiles)
- Browser cache cleared
- User has logged out and back in

### "Regular users can still access settings"

**Check:**
- isSuperAdmin() is being called correctly
- Role is being fetched from database
- useEffect in BrokerAdminDashboard is running
- No stale auth state

### "Role not persisting after login"

**Check:**
- determineUserType() is fetching role field
- profile.role is being set to state
- AuthContext is providing userRole correctly

## Future Enhancements

### Role Management UI

Add interface for super admins to:
- View all users and their roles
- Promote/demote users
- Create new admin accounts
- View audit log of role changes

### Additional Roles

Consider adding more granular roles:
- `admin` - Brokerage-level admin
- `manager` - Team manager
- `viewer` - Read-only access
- `auditor` - Audit log access only

### Permission System

Replace simple role check with permissions:
```typescript
const permissions = {
  'super_admin': ['all'],
  'admin': ['view_claims', 'edit_claims', 'manage_users'],
  'staff': ['view_claims', 'edit_own_claims'],
};
```

## API Reference

### useAuth Hook

```typescript
const {
  userRole,           // Current user's role string
  isSuperAdmin,       // Function: () => boolean
  // ... other auth fields
} = useAuth();
```

### Helper Function

```typescript
// Check if user is super admin
const isSuper = isSuperAdmin();

// Access raw role
if (userRole === 'super_admin') {
  // Do something
}
```

## Migration Notes

If you're adding this to an existing system:

1. **Add role column to profiles:**
```sql
ALTER TABLE broker_profiles ADD COLUMN role text;
ALTER TABLE client_profiles ADD COLUMN role text;
```

2. **Set default roles for existing users:**
```sql
UPDATE broker_profiles SET role = 'staff' WHERE role IS NULL;
UPDATE client_profiles SET role = 'client' WHERE role IS NULL;
```

3. **Promote initial admin:**
```sql
UPDATE broker_profiles SET role = 'super_admin'
WHERE email = 'your-admin@email.com';
```

4. **Clear user sessions:**
   - Users must log out and back in for role changes to take effect

## Summary

The super admin authorization system provides:
- Role-based access control
- Protected admin features
- Multiple layers of security
- Clear access denied messaging
- Easy extensibility for future roles

Only users with `role = 'super_admin'` can access protected admin features like the Settings panel and brokerage management.
