# Invite Password Flow Fix

## Problem
When users clicked Supabase invite links, they landed on `/set-password?token=...&brokerId=...#access_token=...` but the UI showed the normal Login form instead of the password setup screen.

## Solution

### 1. Routing Fix (`src/components/HomePageRouter.tsx`)

Added explicit route handling for `/set-password` **before** any authentication checks:

```typescript
// SET PASSWORD ROUTE: Show SetPassword component for Supabase invite flow
// This MUST come before any auth checks to allow unauthenticated users to set their password
if (currentPath === '/set-password') {
  console.log('🔐 Set password route - showing SetPassword for invite');
  return <SetPassword />;
}
```

This ensures `/set-password` is NOT blocked by ProtectedRoute/AuthGuard redirects.

### 2. SetPassword Component Rewrite (`src/components/SetPassword.tsx`)

Complete rewrite to properly handle Supabase invite flow:

#### Key Features:

1. **Session Establishment from Hash Tokens**
   - Parses `window.location.hash` for `access_token` and `refresh_token`
   - Calls `supabase.auth.setSession({ access_token, refresh_token })`
   - Verifies user with `supabase.auth.getUser()`
   - If no tokens found in hash, shows error: "Invite link is invalid or expired"

2. **Password Setup**
   - Renders "Set your password" form (password + confirm)
   - Validates password requirements (min 6 characters)
   - On submit, calls `supabase.auth.updateUser({ password })`

3. **Post-Password Setup**
   - Marks invitation as used (increments `used_count`)
   - Loads user profile to determine role
   - Redirects based on role:
     - `super_admin` → `/admin-dashboard`
     - `broker/main_broker/admin` → brokerage subdomain or `/dashboard/broker`
     - `client` → `/dashboard/client`

4. **Query Params Preservation**
   - Keeps `token` and `brokerId` query params available
   - Uses them for invitation tracking
   - Does NOT block password setting on these params

5. **UX States**
   - Loading: "Validating invite link..."
   - Error: "Invalid Invite Link" with error message
   - Success: "Password Set Successfully" with redirect spinner
   - Form: Password entry with strength indicator

## Flow

1. User receives Supabase invite email
2. Clicks link → lands on `/set-password?token=XXX&brokerId=YYY#access_token=AAA&refresh_token=BBB`
3. Component extracts tokens from hash
4. Establishes session with `setSession()`
5. Verifies user is authenticated
6. Shows password form
7. User sets password via `updateUser({ password })`
8. Marks invitation used
9. Redirects to appropriate dashboard

## Files Changed

1. **src/components/HomePageRouter.tsx**
   - Added explicit `/set-password` route before auth checks

2. **src/components/SetPassword.tsx**
   - Complete rewrite to handle Supabase invite flow
   - Session establishment from hash tokens
   - Password update using `updateUser()`
   - Role-based redirection

## Testing

Build successful - no errors.

## Notes

- `/set-password` route is now completely public (no auth guard)
- `/signup` route also renders SetPassword for backward compatibility
- Component gracefully handles missing tokens with clear error messages
- All invitation tracking (token, brokerId) preserved for database updates
