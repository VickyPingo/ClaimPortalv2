# Invitation System Documentation

## Overview

The invitation system allows brokerages to securely onboard employees without manual database entry. Brokers can generate invite links that automatically assign new users to the correct brokerage.

## Features

✅ **Secure Token Generation** - Cryptographically secure random tokens
✅ **Expiration Control** - Set custom expiration dates (1-365 days)
✅ **Usage Limits** - Limit how many people can use each invitation
✅ **Role Assignment** - Specify roles (staff, agent, broker, admin)
✅ **Subdomain Validation** - Invitations only work on correct subdomain
✅ **Automatic Deactivation** - Expired or maxed-out invitations become inactive

## Database Schema

### Invitations Table

```sql
invitations (
  id uuid PRIMARY KEY,
  token text UNIQUE NOT NULL,
  brokerage_id uuid NOT NULL REFERENCES brokerages(id),
  role text NOT NULL DEFAULT 'staff',
  expires_at timestamptz NOT NULL,
  used_count integer NOT NULL DEFAULT 0,
  max_uses integer NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)
```

**Key Fields:**
- `token` - Secure random string used in invitation URL
- `brokerage_id` - Which brokerage this invitation belongs to
- `role` - Role to assign when user signs up
- `expires_at` - When invitation becomes invalid
- `used_count` - How many people have used this invitation
- `max_uses` - Maximum allowed uses (NULL = unlimited)
- `is_active` - Whether invitation is active

## Helper Functions

### 1. validate_invitation(token, subdomain)

Validates an invitation token and returns detailed information.

**Parameters:**
- `token` - The invitation token from URL
- `subdomain` - Current subdomain (for validation)

**Returns:**
```typescript
{
  invitation_id: uuid,
  brokerage_id: uuid,
  brokerage_name: text,
  brokerage_subdomain: text,
  role: text,
  is_valid: boolean,
  error_message: text | null
}
```

**Validation Checks:**
- ✅ Invitation exists
- ✅ Subdomain matches brokerage
- ✅ Invitation is active
- ✅ Not expired
- ✅ Not at max uses

### 2. use_invitation(token)

Increments usage count when someone successfully signs up.

**Parameters:**
- `token` - The invitation token

**Returns:**
- `boolean` - Success/failure

### 3. generate_invitation_token()

Generates a secure random token for new invitations.

**Returns:**
- `text` - Base64-encoded random string

## How It Works

### 1. Creating an Invitation

**Admin/Broker Side:**

1. Navigate to Settings → Invitations
2. Click "Create Invitation"
3. Configure:
   - Role (staff, agent, broker, admin)
   - Valid for X days
   - Max uses (optional)
4. Click "Generate Link"
5. Copy the generated URL

**Example URL:**
```
https://claims.independi.co.za/join?token=AbC123XyZ456...
```

### 2. Using an Invitation

**New User Side:**

1. Click invitation link → Redirects to signup page
2. System validates token:
   - ✅ Token exists and is valid
   - ✅ Subdomain matches
   - ✅ Not expired
   - ✅ Not at max uses
3. User sees: "✓ Invitation Accepted - Registering with: Independi"
4. User fills out signup form
5. On submit:
   - Account created with correct `brokerage_id`
   - Invitation `used_count` incremented
   - User assigned specified role

### 3. Security Flow

```
User clicks: claims.independi.co.za/join?token=xyz123
            ↓
System detects token parameter
            ↓
Calls: validate_invitation('xyz123', 'claims.independi.co.za')
            ↓
        Validates:
        ✓ Token exists
        ✓ Belongs to Independi
        ✓ Subdomain matches
        ✓ Not expired
        ✓ Still active
        ✓ Has remaining uses
            ↓
Shows signup form with green banner
"✓ Invitation Accepted - Registering with: Independi"
            ↓
User completes signup
            ↓
Account created → brokerage_id = Independi's ID
            ↓
Calls: use_invitation('xyz123')
            ↓
Increments used_count
```

## Admin Interface

### Invitation Manager Component

Located in: `src/components/admin/InvitationManager.tsx`

**Features:**
- View all invitations for current brokerage
- Create new invitations
- Copy invitation links
- Deactivate invitations
- See usage statistics

**UI Elements:**

**Active Invitation Card:**
```
┌─────────────────────────────────────────┐
│ [Active]  Staff                         │
│ 👥 3/10 uses  📅 Expires Feb 17, 2026  │
│ https://claims.independi.co.za/join?... │
│                         [Copy] [Delete] │
└─────────────────────────────────────────┘
```

**Inactive Invitation Card:**
```
┌─────────────────────────────────────────┐
│ [Inactive]  Broker                      │
│ 👥 10/10 uses  📅 Expired Jan 5, 2026  │
│ ⚠️ Max uses reached                     │
│ https://claims.independi.co.za/join?... │
│                                  [Copy] │
└─────────────────────────────────────────┘
```

## Usage Examples

### Example 1: Onboard 5 New Agents

**Scenario:** Independi needs to onboard 5 new agents.

**Steps:**
1. Admin logs into `claims.independi.co.za`
2. Goes to Settings → Invitations
3. Creates invitation:
   - Role: `agent`
   - Valid for: `14 days`
   - Max uses: `5`
4. Copies link: `https://claims.independi.co.za/join?token=abc123`
5. Sends link to 5 new agents via email
6. Each agent:
   - Clicks link
   - Fills out signup form
   - Account automatically created with Independi's `brokerage_id`
   - Assigned `agent` role
7. After 5 uses, invitation automatically deactivates

### Example 2: Permanent Recruiting Link

**Scenario:** Independi wants a permanent recruiting link.

**Steps:**
1. Create invitation:
   - Role: `staff`
   - Valid for: `365 days`
   - Max uses: `(leave empty for unlimited)`
2. Post link on recruiting page
3. Link remains active for 1 year
4. Unlimited people can sign up
5. All assigned to Independi with `staff` role

### Example 3: Single-Use Admin Invitation

**Scenario:** Hire one new admin.

**Steps:**
1. Create invitation:
   - Role: `admin`
   - Valid for: `7 days`
   - Max uses: `1`
2. Send link directly to candidate
3. Candidate signs up
4. Invitation automatically deactivates after first use

## Security Features

### 1. Token Security
- **Cryptographically Secure**: Uses `gen_random_bytes(24)` for tokens
- **Unpredictable**: Cannot be guessed or brute-forced
- **Base64 Encoded**: URL-safe format

### 2. Subdomain Validation
- Invitations only work on the brokerage's subdomain
- Prevents cross-brokerage usage
- Example: Independi invitation won't work on Demo Broker subdomain

### 3. Expiration Control
- All invitations have expiration dates
- Expired invitations automatically become invalid
- Prevents stale invitations from being used

### 4. Usage Limits
- Optional max uses per invitation
- Prevents abuse of permanent links
- Automatic deactivation when limit reached

### 5. Row Level Security (RLS)
```sql
-- Brokers can only see their brokerage's invitations
CREATE POLICY "Brokers can view org invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    brokerage_id IN (
      SELECT brokerage_id FROM broker_profiles
      WHERE id = auth.uid()
    )
  );
```

## API Reference

### Database Functions

#### validate_invitation(token_param text, subdomain_param text)

```sql
SELECT * FROM validate_invitation(
  'abc123xyz',
  'claims.independi.co.za'
);

-- Returns:
{
  "invitation_id": "uuid",
  "brokerage_id": "uuid",
  "brokerage_name": "Independi",
  "brokerage_subdomain": "claims.independi.co.za",
  "role": "staff",
  "is_valid": true,
  "error_message": null
}
```

#### use_invitation(token_param text)

```sql
SELECT use_invitation('abc123xyz');

-- Returns: true (if successful)
```

#### generate_invitation_token()

```sql
SELECT generate_invitation_token();

-- Returns: "AbC123XyZ456..."
```

## Troubleshooting

### Issue: "Invalid invitation token"

**Cause:** Token doesn't exist in database.

**Solution:**
- Verify token in URL is correct
- Check if invitation was deleted
- Generate a new invitation

### Issue: "This invitation has expired"

**Cause:** Current date/time is past `expires_at`.

**Solution:**
- Create a new invitation with longer validity
- Or update existing invitation's `expires_at`

### Issue: "This invitation has reached its maximum number of uses"

**Cause:** `used_count >= max_uses`.

**Solution:**
- Create a new invitation
- Or update `max_uses` to higher number
- Or set `max_uses` to NULL for unlimited

### Issue: "This invitation is not valid for this domain"

**Cause:** Trying to use invitation on wrong subdomain.

**Solution:**
- Ensure you're on the correct subdomain
- Example: Independi invitation only works on `claims.independi.co.za`

### Issue: Invitation not appearing in admin panel

**Cause:** RLS policy blocking access.

**Solution:**
- Verify user is logged in as broker
- Check user's `brokerage_id` matches invitation's `brokerage_id`

## Testing

### Test Case 1: Create and Use Invitation

```sql
-- 1. Create invitation
INSERT INTO invitations (brokerage_id, role, expires_at, max_uses)
VALUES (
  '10000000-0000-0000-0000-000000000001', -- Independi
  'staff',
  now() + interval '7 days',
  5
)
RETURNING token;

-- 2. Validate invitation
SELECT * FROM validate_invitation(
  'returned_token_here',
  'claims.independi.co.za'
);

-- 3. Use invitation (after signup)
SELECT use_invitation('returned_token_here');

-- 4. Check usage
SELECT used_count FROM invitations WHERE token = 'returned_token_here';
-- Should show: 1
```

### Test Case 2: Expired Invitation

```sql
-- Create expired invitation
INSERT INTO invitations (brokerage_id, role, expires_at)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'staff',
  now() - interval '1 day' -- Expired yesterday
)
RETURNING token;

-- Try to validate
SELECT * FROM validate_invitation('token_here', 'claims.independi.co.za');
-- Should return: is_valid = false, error_message = "This invitation has expired"
```

### Test Case 3: Max Uses Reached

```sql
-- Create invitation with max_uses = 1
INSERT INTO invitations (brokerage_id, role, max_uses)
VALUES ('brokerage_id', 'staff', 1)
RETURNING token;

-- Use it once
SELECT use_invitation('token_here'); -- Returns: true

-- Try to use again
SELECT use_invitation('token_here'); -- Returns: false
```

## Best Practices

1. **Set Appropriate Expiration Dates**
   - Short-term hires: 7-14 days
   - Recruiting campaigns: 30-90 days
   - Maximum: 365 days

2. **Use Max Uses When Possible**
   - Prevents abuse of shared links
   - Better tracking of invitation effectiveness
   - Recommended except for public recruiting

3. **Assign Correct Roles**
   - Start with lowest privilege (staff)
   - Promote users later if needed
   - Use admin role sparingly

4. **Deactivate Unused Invitations**
   - Clean up old invitations regularly
   - Deactivate if hiring filled
   - Reduces attack surface

5. **Monitor Usage**
   - Check invitation analytics regularly
   - Track which invitations are most effective
   - Identify unused invitations

## File Reference

### Backend (Database)
- `supabase/migrations/create_invitation_system.sql` - Database schema and functions

### Frontend Components
- `src/components/admin/InvitationManager.tsx` - Admin UI for managing invitations
- `src/components/admin/SettingsPanel.tsx` - Settings panel with invitations tab
- `src/components/Login.tsx` - Signup flow with invitation handling

### Modified Files
- `src/components/admin/BrokerAdminDashboard.tsx` - Added settings panel
- `src/contexts/AuthContext.tsx` - Handles invitation-based signup

## Summary

The invitation system provides a secure, scalable way to onboard employees:

✅ **No Manual Database Entry** - Everything automated
✅ **Secure by Default** - Multiple validation layers
✅ **Flexible Configuration** - Roles, expiration, limits
✅ **Brokerage Isolation** - Invitations scoped to brokerage
✅ **User-Friendly** - Simple copy/paste invite links
✅ **Admin Control** - Full management via web UI

Each brokerage can now manage their own team onboarding independently, with complete security and data isolation.
