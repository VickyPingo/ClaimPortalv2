# Sign-Up Flow Documentation

## Overview

The sign-up logic has been enhanced to enforce strict brokerage-based registration. Users can ONLY sign up on domains that have a valid brokerage configuration in the database.

## How It Works

### 1. Subdomain Detection

When a user visits any URL, the `BrokerageContext` automatically:
1. Detects `window.location.hostname`
2. Queries the `brokerages` table for a matching `subdomain`
3. Loads the brokerage configuration if found

**Example:**
```
User visits: claims.independi.co.za
            ↓
System queries: SELECT * FROM brokerages WHERE subdomain = 'claims.independi.co.za'
            ↓
Result: Independi brokerage found (ID: 10000000-0000-0000-0000-000000000001)
```

### 2. Sign-Up Validation

Before allowing registration, the system checks:
- ✅ Is there a valid brokerage for this domain?
- ✅ If yes → Allow sign-up and assign `brokerage_id`
- ❌ If no → Prevent sign-up and show error message

### 3. Automatic Brokerage Assignment

When a user successfully signs up:
```typescript
// The brokerage_id is automatically included
await brokerSignUp(email, password, {
  full_name: 'John Doe',
  id_number: '1234567890',
  cell_number: '+27 71 123 4567',
});

// Behind the scenes:
// - Detects current brokerage from context
// - Creates broker_users record with brokerage_id
// - Creates broker_profiles record with brokerage_id
// - User is now linked to that specific brokerage
```

## User Experience

### On Valid Subdomain (e.g., claims.independi.co.za)

**Login Page:**
- Shows "Independi" as page title
- Sign-in button styled with Independi's brand color
- "Sign Up" link is visible and clickable

**Sign-Up Page:**
- Shows blue info box: "Registering with: Independi"
- All form fields enabled
- Submit button enabled
- User can complete registration

### On Invalid/Unconfigured Domain

**Login Page:**
- Shows generic "Claims Portal" title
- Error message: "Configuration Error - Unable to load brokerage configuration"
- "Sign Up" link shows warning: "Sign up is not available on this domain. Please contact your broker for access."

**Sign-Up Page (if somehow reached):**
- Shows red error box: "Cannot register: This domain is not configured for sign-ups"
- Submit button is disabled
- Form cannot be submitted

## Updated Components

### 1. Login.tsx
**Changes:**
- Imports and uses `useBrokerage()` hook
- Sign-up button only shows if `brokerage` exists
- Shows warning message if no brokerage found

**Code:**
```typescript
const { brokerage } = useBrokerage();

{brokerage ? (
  <button onClick={() => setShowSignup(true)}>Sign Up</button>
) : (
  <p>Sign up is not available on this domain. Please contact your broker.</p>
)}
```

### 2. Signup Component (in Login.tsx)
**Changes:**
- Shows "Registering with: {brokerage.name}" banner
- Validates brokerage exists before submission
- Submit button disabled if no brokerage
- Clear error messages

### 3. ClientAuth.tsx
**Changes:**
- Same validation as Login.tsx
- Uses `useBrokerage()` hook
- Shows brokerage name during signup
- Prevents registration on invalid domains
- Automatically assigns `brokerage_id` from context

### 4. BrokerageContext.tsx
**Changes:**
- Improved error messages show detected domain
- Example: "No brokerage configuration found for domain: claims.example.com"

## Security Benefits

1. **Prevents Unauthorized Registration**: Only configured subdomains can register users
2. **Automatic Data Isolation**: All new users inherit correct `brokerage_id`
3. **No Manual Assignment**: No risk of human error in assigning brokerages
4. **Clear Error Messages**: Users know exactly why they can't sign up

## Testing

### Test Case 1: Sign-Up on Valid Subdomain

1. Visit `claims.independi.co.za`
2. Click "Sign Up"
3. Verify: Blue banner shows "Registering with: Independi"
4. Complete form and submit
5. Verify: New user has `brokerage_id = Independi's ID`

**SQL Verification:**
```sql
SELECT id, full_name, brokerage_id
FROM broker_profiles
WHERE email = 'test@example.com';

-- Should show:
-- brokerage_id: 10000000-0000-0000-0000-000000000001 (Independi)
```

### Test Case 2: Sign-Up on Invalid Domain

1. Visit domain that's NOT in `brokerages` table
2. Verify: Error screen shows "Configuration Error"
3. Click "Sign Up" (if button appears)
4. Verify: Warning shows "Sign up is not available"
5. Try to submit form
6. Verify: Submit button is disabled

### Test Case 3: Localhost Development

1. Visit `http://localhost:5173`
2. Verify: Defaults to `app.claimsplatform.com` brokerage
3. Sign-up works with default brokerage
4. New users assigned to default brokerage

## Adding New Subdomains

To enable sign-ups on a new domain:

```sql
INSERT INTO brokerages (name, subdomain, brand_color, notification_email)
VALUES (
  'New Brokerage',
  'claims.newbrokerage.com',
  '#ff6600',
  'claims@newbrokerage.com'
);
```

**Result:** Sign-ups immediately enabled on that subdomain with automatic brokerage assignment.

## Troubleshooting

### Issue: "Sign up is not available on this domain"

**Cause:** The current domain is not in the `brokerages` table.

**Solution:**
```sql
-- Check if subdomain exists
SELECT * FROM brokerages WHERE subdomain = 'claims.yoursite.com';

-- If not found, add it
INSERT INTO brokerages (name, subdomain)
VALUES ('Your Brokerage', 'claims.yoursite.com');
```

### Issue: User registered with wrong brokerage_id

**Cause:** This should no longer happen with the new logic.

**How to verify:**
```sql
-- Check user's brokerage assignment
SELECT
  bp.full_name,
  bp.brokerage_id,
  b.name as brokerage_name,
  b.subdomain
FROM broker_profiles bp
JOIN brokerages b ON bp.brokerage_id = b.id
WHERE bp.email = 'user@example.com';
```

### Issue: Localhost not working

**Cause:** Localhost defaults to `app.claimsplatform.com` subdomain.

**Solution:** Ensure default brokerage exists:
```sql
SELECT * FROM brokerages WHERE subdomain = 'app.claimsplatform.com';
```

## Code Flow Diagram

```
User visits URL
       ↓
BrokerageContext detects hostname
       ↓
Queries: get_brokerage_by_subdomain(hostname)
       ↓
   ┌─────────────────┐
   │ Brokerage Found?│
   └────────┬────────┘
           / \
         /     \
       YES     NO
        ↓       ↓
  Load config  Show error
  Set context  Disable signup
        ↓
  User clicks "Sign Up"
        ↓
  Shows brokerage name
  "Registering with: Independi"
        ↓
  User fills form
        ↓
  Validates brokerage exists
        ↓
  brokerSignUp(email, password, profile)
        ↓
  Gets brokerage.id from context
        ↓
  Creates user with correct brokerage_id
        ↓
  Success! User linked to brokerage
```

## Summary

The enhanced sign-up logic ensures:
- ✅ Only configured subdomains can register users
- ✅ Users are automatically assigned to correct brokerage
- ✅ Clear error messages when domain is not configured
- ✅ No manual brokerage assignment needed
- ✅ Complete data isolation by brokerage
- ✅ Improved security and user experience
