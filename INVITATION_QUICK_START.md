# Invitation System - Quick Start Guide

## For Admins: Creating Invitations

### Step 1: Navigate to Invitations
1. Log into your brokerage dashboard
2. Click **Settings** in the sidebar
3. Click **Invitations** tab

### Step 2: Create New Invitation
1. Click **"Create Invitation"** button
2. Fill in the form:
   - **Role**: Choose staff, agent, broker, or admin
   - **Valid for (days)**: How long invitation is valid (1-365 days)
   - **Max uses**: Leave empty for unlimited, or set a number
3. Click **"Generate Link"**

### Step 3: Share the Link
1. Click the **Copy** button next to the invitation
2. Share the link via email, Slack, etc.
3. Recipients click the link and complete signup

**Example Invitation URL:**
```
https://claims.independi.co.za/join?token=AbC123XyZ456
```

## For New Users: Joining via Invitation

### Step 1: Click the Invitation Link
You'll receive a link like:
```
https://claims.independi.co.za/join?token=xyz123
```

### Step 2: Complete Signup Form
1. You'll see: **"✓ Invitation Accepted - Registering with: [Brokerage Name]"**
2. Fill in:
   - Full Name
   - ID Number
   - Cell Number
   - Email
   - Password
3. Click **"Create Account"**

### Step 3: Start Using the Platform
- Your account is automatically created
- You're assigned to the correct brokerage
- You're given the role specified in the invitation

## Common Scenarios

### Scenario 1: Onboard 5 New Agents
```
Role: agent
Valid for: 14 days
Max uses: 5

Result: First 5 people who use the link become agents
```

### Scenario 2: Permanent Recruiting Link
```
Role: staff
Valid for: 365 days
Max uses: (empty/unlimited)

Result: Link works for 1 year, unlimited uses
```

### Scenario 3: Single Admin Hire
```
Role: admin
Valid for: 7 days
Max uses: 1

Result: First person gets admin access, link becomes inactive
```

## Invitation Status

### Active Invitation
```
✅ Green "Active" badge
📋 Can be copied and shared
🗑️ Can be deactivated
```

### Inactive Invitation
```
⚪ Gray "Inactive" badge
❌ Cannot be used for signup
📋 Can still view the link
```

**Reasons for Inactive:**
- ⏰ Expired (past expiration date)
- 🔢 Max uses reached
- 🗑️ Manually deactivated

## Security Notes

✅ **Invitations only work on the correct subdomain**
   - Independi invitation → Only works on claims.independi.co.za
   - Won't work on other brokerages' subdomains

✅ **Tokens are cryptographically secure**
   - Cannot be guessed
   - Cannot be brute-forced

✅ **Automatic expiration**
   - All invitations expire after set time
   - Prevents stale invitations

✅ **Usage tracking**
   - See how many people used each invitation
   - Deactivates when max uses reached

## Troubleshooting

### "Invalid invitation token"
❌ **Problem**: Token doesn't exist
✅ **Solution**: Ask admin to generate a new invitation

### "This invitation has expired"
❌ **Problem**: Past expiration date
✅ **Solution**: Ask admin to create a new invitation

### "This invitation has reached its maximum number of uses"
❌ **Problem**: Too many people used this link
✅ **Solution**: Ask admin to create a new invitation

### "This invitation is not valid for this domain"
❌ **Problem**: Wrong subdomain
✅ **Solution**: Make sure you're on the correct domain (e.g., claims.independi.co.za)

## Quick Reference

| Action | Location | Access Level |
|--------|----------|--------------|
| Create Invitation | Settings → Invitations | Admin/Broker |
| View Invitations | Settings → Invitations | Admin/Broker |
| Copy Link | Invitation card → Copy button | Admin/Broker |
| Deactivate | Invitation card → Delete button | Admin/Broker |
| Use Invitation | Click link → Complete signup | Anyone with link |

## Tips

💡 **For Short-term Hires**: Set max_uses to exact number needed
💡 **For Recruiting**: Use longer expiration (30-90 days)
💡 **For Security**: Use single-use invitations for admin roles
💡 **For Tracking**: Check invitation analytics regularly
💡 **For Cleanup**: Deactivate old unused invitations

## Need Help?

- Check full documentation: `INVITATION_SYSTEM_DOCUMENTATION.md`
- Contact system administrator
- Review invitation validation errors on signup page
