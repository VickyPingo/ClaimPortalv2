# User Creation Logic - Fixed

## Problem Summary
Users signing up with the `?broker=independi` link were being assigned the 'Staff' role instead of 'Broker', and metadata wasn't being properly passed during signup. The delete button in User Management was also failing, and role badges showed incorrect labels.

## Solutions Implemented

### 1. Force 'Broker' Role for Broker Sign-ups

**File: src/contexts/AuthContext.tsx**

#### Before
```typescript
const { data: authData, error: authError } = await supabase.auth.signUp({
  email,
  password,
});

// In broker_users insert
role: 'staff',  // ❌ Wrong - should be 'broker'
```

#### After
```typescript
const { data: authData, error: authError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: profile.full_name,
      role: 'broker',  // ✅ Correct
      brokerage_id: targetBrokerageId,
      user_type: 'broker',
    },
  },
});

// In broker_users insert
role: 'broker',  // ✅ Correct

// In broker_profiles insert
role: 'broker',  // ✅ Added
```

**Changes:**
- Line 314-320: Added `options.data` object with metadata
- Line 329: Changed role from 'staff' to 'broker' in broker_users
- Line 350: Added role field to broker_profiles insert

### 2. Client Sign-up with Proper Metadata

**File: src/contexts/AuthContext.tsx**

#### Before
```typescript
const { data: authData, error: authError } = await supabase.auth.signUp({
  email,
  password,
});
// No metadata passed
```

#### After
```typescript
const { data: authData, error: authError } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: profile.full_name,
      role: 'client',  // ✅ Correct
      brokerage_id: currentBrokerageId,
      user_type: 'client',
    },
  },
});
```

**Changes:**
- Line 390-402: Added `options.data` object with client metadata
- Metadata includes: `full_name`, `role`, `brokerage_id`, `user_type`

### 3. Fixed Delete Button Functionality

**File: src/components/admin/UsersManager.tsx**

#### Before
```typescript
const deleteUser = async (userId: string) => {
  // Only deleted from broker_profiles and broker_users
  // Did not handle client profiles
};
```

#### After
```typescript
const deleteUser = async (userId: string) => {
  try {
    // Delete from broker_profiles
    await supabase.from('broker_profiles').delete().eq('id', userId);

    // Delete from broker_users
    await supabase.from('broker_users').delete().eq('id', userId);

    // Delete from client_profiles (in case it's a client)
    await supabase.from('client_profiles').delete().eq('id', userId);

    // Note: auth.users deletion handled by cascade
  }
};
```

**Changes:**
- Line 75-117: Enhanced delete function to handle both brokers and clients
- Added error handling for each delete operation
- Added console logging for debugging

### 4. Fixed Role Badge Display (British English)

**File: src/components/admin/UsersManager.tsx**

#### Before
```typescript
{user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Staff'}
// ❌ Shows 'Staff' for all non-admin users
```

#### After
```typescript
{user.role === 'super_admin'
  ? 'Super Admin'
  : user.role === 'admin'
  ? 'Admin'
  : user.role === 'broker'
  ? 'Broker'  // ✅ Shows 'Broker'
  : user.role === 'client'
  ? 'Client'  // ✅ Shows 'Client'
  : 'Staff'}
```

**Changes:**
- Line 216-240: Updated role badge display logic
- Added proper colour coding:
  - Super Admin: Purple (bg-purple-100 text-purple-700)
  - Admin: Blue (bg-blue-100 text-blue-700)
  - Broker: Blue (bg-blue-100 text-blue-700)
  - Client: Green (bg-green-100 text-green-700)
  - Staff: Grey (bg-gray-100 text-gray-700)

### 5. Enhanced User Management to Show All Users

**File: src/components/admin/UsersManager.tsx**

#### Before
```typescript
// Only loaded broker users
const { data: brokerData } = await supabase.from('broker_profiles').select();
```

#### After
```typescript
// Loads both broker and client users
const { data: brokerData } = await supabase.from('broker_profiles').select();
const { data: clientData } = await supabase.from('client_profiles').select();

// Combines and sorts all users
const allUsers = [...formattedBrokers, ...formattedClients].sort();
```

**Changes:**
- Line 26-102: Enhanced `loadUsers` function to fetch both brokers and clients
- Fetches emails from auth.users for both user types
- Combines and sorts users by creation date
- Displays all users in a unified list

## Metadata Passed to Database Trigger

When users sign up, the following metadata is now passed in `options.data`:

### Broker Sign-up (?broker=independi)
```typescript
{
  full_name: "John Doe",
  role: "broker",
  brokerage_id: "10000000-0000-0000-0000-000000000001",
  user_type: "broker"
}
```

### Client Sign-up (Claims Portal)
```typescript
{
  full_name: "Jane Doe",
  role: "client",
  brokerage_id: "<brokerage_id>",
  user_type: "client"
}
```

This metadata is accessible in database triggers via:
- `auth.uid()` - The user's ID
- `auth.jwt()` - Contains the metadata in `raw_user_meta_data`

## Testing Scenarios

### Test 1: Broker Sign-up
```
1. Visit: https://claimsportal.co.za/?broker=independi
2. Click "Sign Up"
3. Fill in form with:
   - Full Name: Test Broker
   - ID Number: 1234567890123
   - Cell Number: +27 71 123 4567
   - Email: testbroker@example.com
   - Password: TestPass123
4. Submit form
5. Check database:
   - broker_profiles.role = 'broker' ✅
   - broker_users.role = 'broker' ✅
   - Auth metadata contains role: 'broker' ✅
```

### Test 2: Client Sign-up
```
1. Visit: https://<brokerage-subdomain>.claimsportal.co.za
2. Click "Sign Up as Client"
3. Fill in form with:
   - Full Name: Test Client
   - Cell Number: +27 71 123 4567
   - Email: testclient@example.com
   - Password: TestPass123
4. Submit form
5. Check database:
   - client_profiles.role = 'client' ✅
   - Auth metadata contains role: 'client' ✅
```

### Test 3: Delete User
```
1. Login as Super Admin (vickypingo@gmail.com)
2. Navigate to Users Management
3. Click delete button next to a user
4. Confirm deletion
5. Check database:
   - User removed from broker_profiles ✅
   - User removed from broker_users ✅
   - User removed from client_profiles (if client) ✅
```

### Test 4: Role Badge Display
```
1. Login as Super Admin
2. Navigate to Users Management
3. Verify role badges show:
   - 'Super Admin' for super_admin role ✅
   - 'Admin' for admin role ✅
   - 'Broker' for broker role ✅
   - 'Client' for client role ✅
   - NOT 'Staff' for broker/client roles ✅
```

## Database Structure

### broker_profiles
```sql
CREATE TABLE broker_profiles (
  id uuid PRIMARY KEY,
  brokerage_id uuid NOT NULL,
  full_name text NOT NULL,
  id_number text NOT NULL,
  cell_number text NOT NULL,
  policy_number text,
  role text DEFAULT 'broker',  -- ✅ Now defaults to 'broker'
  user_type text DEFAULT 'broker',
  created_at timestamptz DEFAULT now()
);
```

### broker_users
```sql
CREATE TABLE broker_users (
  id uuid PRIMARY KEY,
  brokerage_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  role text DEFAULT 'broker',  -- ✅ Now defaults to 'broker'
  created_at timestamptz DEFAULT now()
);
```

### client_profiles
```sql
CREATE TABLE client_profiles (
  id uuid PRIMARY KEY,
  brokerage_id uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  cell_number text NOT NULL,
  role text DEFAULT 'client',  -- ✅ Always 'client'
  user_type text DEFAULT 'client',
  created_at timestamptz DEFAULT now()
);
```

## Files Modified

1. **src/contexts/AuthContext.tsx**
   - Lines 304-358: Updated `brokerSignUp` to pass metadata and use 'broker' role
   - Lines 385-425: Updated `clientSignUp` to pass metadata and use 'client' role

2. **src/components/admin/UsersManager.tsx**
   - Lines 26-102: Enhanced `loadUsers` to fetch both brokers and clients
   - Lines 75-117: Fixed `deleteUser` to handle both user types
   - Lines 216-240: Updated role badge display with proper labels

## Current Status

✅ Broker sign-ups now create users with role 'broker' (not 'staff')
✅ Client sign-ups now create users with role 'client'
✅ Metadata (full_name, role, brokerage_id) passed in auth.signUp options.data
✅ Database triggers can access metadata via auth.jwt()
✅ Delete button now handles both brokers and clients
✅ Role badges display 'Broker' and 'Client' correctly (British English)
✅ User Management shows all users (brokers and clients combined)
✅ Build successful with no errors

## Notes

- The role field is now consistently set across all tables
- Metadata is passed to Supabase Auth for trigger access
- The delete functionality gracefully handles both user types
- Users are displayed with proper role identification
- The system fully supports multi-tenancy with proper role segregation
