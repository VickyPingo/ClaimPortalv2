# Client Portal - Past Claims Feature

## Overview
Added a new "Past Claims" section to the Client Portal that allows clients to view their claim history and access detailed claim information.

## Changes Made

### 1. New Components

#### ClientPastClaims.tsx
A full-featured claims list component that displays all claims for the logged-in client.

**Features:**
- Fetches claims from Supabase filtered by `user_id`
- Displays claims in responsive table (desktop) and card layout (mobile)
- Shows claim type, status, submission date, and policy number
- Status badges with color coding (new, pending, in progress, approved, rejected, closed)
- Summary statistics showing total, pending, approved, and closed claims
- Empty state with helpful messaging when no claims exist
- Loading state with spinner
- Error handling with clear error messages
- "View" button on each claim row/card to see details

**Props:**
- `onViewClaim: (claimId: string) => void` - Callback when user clicks to view a claim
- `onBack: () => void` - Callback to return to main portal

**Database Query:**
```typescript
supabase
  .from('claims')
  .select('id, incident_type, status, created_at, claimant_name, policy_number')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
```

**Status Color Coding:**
- New: Blue
- Pending: Yellow
- In Progress: Orange
- Approved: Green
- Rejected: Red
- Closed: Gray

---

#### ClientClaimDetail.tsx
A placeholder component for displaying detailed claim information.

**Features:**
- Displays claim ID in header
- Back button to return to claims list
- Placeholder content indicating this page will show comprehensive claim details
- Ready for future implementation of:
  - Claim status timeline
  - Uploaded documents/photos
  - Broker notes and updates
  - Communication history

**Props:**
- `claimId: string` - The ID of the claim to display
- `onBack: () => void` - Callback to return to claims list

---

### 2. Modified Components

#### ClientPortal.tsx

**Imports Added:**
```typescript
import ClientPastClaims from './ClientPastClaims';
import ClientClaimDetail from './ClientClaimDetail';
import { History } from 'lucide-react';
```

**New State:**
```typescript
type ViewMode = 'home' | 'past-claims' | 'claim-detail';
const [viewMode, setViewMode] = useState<ViewMode>('home');
const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
```

**View Routing Logic:**
The component now supports three view modes:
1. `'home'` - Main claim submission interface (default)
2. `'past-claims'` - Past claims list view
3. `'claim-detail'` - Individual claim detail view

**Navigation Added:**
A "Past Claims" button was added to the header of the main portal view:

```typescript
<button
  onClick={() => setViewMode('past-claims')}
  className="flex items-center px-4 py-2 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition font-medium"
>
  <History className="w-5 h-5 mr-2" />
  Past Claims
</button>
```

**Conditional Rendering:**
Added view routing at the top of the component's return statement:

```typescript
// Handle Past Claims view
if (viewMode === 'past-claims') {
  return (
    <ClientPastClaims
      onViewClaim={(claimId) => {
        setSelectedClaimId(claimId);
        setViewMode('claim-detail');
      }}
      onBack={() => setViewMode('home')}
    />
  );
}

// Handle Claim Detail view
if (viewMode === 'claim-detail' && selectedClaimId) {
  return (
    <ClientClaimDetail
      claimId={selectedClaimId}
      onBack={() => {
        setSelectedClaimId(null);
        setViewMode('past-claims');
      }}
    />
  );
}
```

---

## Navigation Flow

```
Client Portal Home (File a Claim)
  │
  ├─→ Click "Past Claims" button
  │    │
  │    └─→ Past Claims List
  │         │
  │         ├─→ Click "View" on any claim
  │         │    │
  │         │    └─→ Claim Detail (placeholder)
  │         │         │
  │         │         └─→ Click "Back" → Returns to Past Claims List
  │         │
  │         └─→ Click "Back to Portal" → Returns to Client Portal Home
  │
  └─→ Click any claim type card → Claim submission flow (unchanged)
```

---

## Database Schema Reference

### Claims Table Columns Used

The feature queries the following columns from the `claims` table:

```sql
- id (uuid) - Claim unique identifier
- incident_type (text) - Type of claim (motor_accident, burst_geyser, etc.)
- status (text) - Current status (new, pending, in_progress, approved, rejected, closed)
- created_at (timestamptz) - Timestamp when claim was submitted
- claimant_name (text) - Name of person who filed the claim
- policy_number (text) - Insurance policy number
- user_id (uuid) - References auth.users(id) - Used to filter claims
```

### RLS Policy

The feature relies on the existing RLS policy:

```sql
CREATE POLICY "Users can view own claims by user_id"
  ON claims FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
```

This ensures clients can **only see their own claims**.

---

## UI/UX Details

### Desktop View (Table)
- Clean table layout with headers
- Rows with hover effect
- Claim type icon and label
- Color-coded status badges
- Formatted date/time
- Policy number or "N/A"
- Action button aligned right

### Mobile View (Cards)
- Stacked card layout
- Each card shows all claim info
- Status badge positioned top-right
- Full-width action button at bottom
- Touch-friendly spacing

### Empty State
- Large icon (FileText)
- Friendly message
- Call-to-action button to submit first claim
- Encourages user engagement

### Loading State
- Centered spinner
- Loading message
- Prevents interaction during data fetch

### Error State
- Red error banner with icon
- Clear error message
- Displays above content area

### Summary Statistics
- Shows total claims count
- Pending claims count (new + pending status)
- Approved claims count
- Closed claims count
- Grid layout responsive to screen size

---

## Styling Consistency

All new components follow the existing portal design language:

**Colors:**
- Background: `bg-gradient-to-br from-blue-50 to-blue-100`
- Cards: `bg-white` with `rounded-xl shadow-lg`
- Primary action: `bg-blue-600 hover:bg-blue-700`
- Text hierarchy: `text-gray-900` (headers), `text-gray-600` (body)

**Typography:**
- Headers: `text-3xl font-bold`
- Subheaders: `text-xl font-semibold`
- Body: `text-sm` or `text-base`

**Spacing:**
- Consistent padding: `p-4`, `p-6`, `p-8`
- Gaps: `gap-3`, `gap-4`, `gap-6`
- Margins: `mb-4`, `mb-6`, `mb-8`

**Icons:**
- From lucide-react
- Size: `w-5 h-5` (buttons), `w-16 h-16` (empty states)
- Consistent with existing portal icons

---

## Testing Checklist

### Functionality
- [ ] "Past Claims" button appears in client portal header
- [ ] Clicking "Past Claims" navigates to claims list
- [ ] Claims list displays only the logged-in client's claims
- [ ] Claims are ordered by submission date (newest first)
- [ ] Empty state displays when client has no claims
- [ ] Loading state displays while fetching claims
- [ ] Error state displays if fetch fails
- [ ] Status badges display correct colors
- [ ] Claim types display correct labels
- [ ] Dates format correctly
- [ ] Policy numbers display or show "N/A"
- [ ] Summary statistics calculate correctly
- [ ] "View" button on each claim works
- [ ] Clicking "View" navigates to claim detail page
- [ ] Claim ID displays in detail page header
- [ ] "Back" button from detail returns to claims list
- [ ] "Back to Portal" button returns to main portal
- [ ] Navigation state persists correctly

### Responsive Design
- [ ] Desktop table view displays correctly
- [ ] Mobile card view displays correctly
- [ ] Layout switches at appropriate breakpoint
- [ ] All buttons are touch-friendly on mobile
- [ ] Text is readable on all screen sizes
- [ ] No horizontal scrolling on mobile

### Security
- [ ] Client can only see their own claims
- [ ] No claims from other users visible
- [ ] RLS policies enforced
- [ ] No unauthorized data access possible

### Performance
- [ ] Claims load quickly (< 2 seconds)
- [ ] No unnecessary re-renders
- [ ] Smooth transitions between views
- [ ] No console errors

---

## Future Enhancements

### For Claim Detail Page:
1. **Status Timeline**
   - Visual timeline showing claim progression
   - Date/time stamps for each status change
   - Broker notes at each stage

2. **Document Viewer**
   - Display all uploaded photos/videos
   - Lightbox gallery for images
   - Download buttons for documents

3. **Communication Thread**
   - Messages between client and broker
   - Ability to send new messages
   - Notification of new broker responses

4. **Claim Information**
   - All submitted form data
   - Location on map (if applicable)
   - Third-party details (motor accidents)
   - Voice transcript (if available)

5. **Actions**
   - Ability to add additional documents
   - Request for updates
   - Withdraw claim option

### For Claims List:
1. **Filters**
   - Filter by status
   - Filter by claim type
   - Date range picker

2. **Search**
   - Search by claim ID
   - Search by policy number
   - Search by date

3. **Sorting**
   - Sort by date (asc/desc)
   - Sort by status
   - Sort by claim type

4. **Pagination**
   - Load more button
   - Or infinite scroll
   - Handle large numbers of claims

5. **Export**
   - Download claims list as PDF
   - Export to CSV

---

## Implementation Notes

### Simple Routing
This implementation uses state-based routing (`viewMode`) rather than URL-based routing. This keeps the implementation simple and consistent with the existing ClientPortal pattern.

**Pros:**
- No additional routing library needed
- Consistent with existing portal structure
- Simple to implement and maintain

**Cons:**
- No browser back button support
- No deep linking to specific claims
- State resets on page refresh

**Future Consideration:**
If the client portal grows significantly, consider migrating to React Router for:
- URL-based navigation
- Deep linking support
- Browser history integration
- Better SEO (if applicable)

### Data Fetching
Currently uses direct Supabase queries in components. For a production app, consider:
- Custom hooks for data fetching
- Query caching (React Query / SWR)
- Optimistic updates
- Real-time subscriptions for claim updates

### Error Handling
Basic error handling is implemented. For production:
- More specific error messages
- Retry logic for failed requests
- Offline support
- Error reporting service integration

---

## Build Status

✅ Build successful
✅ No TypeScript errors
✅ No linting errors
✅ All imports resolved

---

## Files Modified

1. `src/components/ClientPortal.tsx` - Added navigation and view routing
2. `src/components/ClientPastClaims.tsx` - New component (created)
3. `src/components/ClientClaimDetail.tsx` - New component (created)

## Files to Complete Later

The `ClientClaimDetail.tsx` component is currently a placeholder. Future work should:
1. Fetch full claim details from database
2. Display all claim data in organized sections
3. Show uploaded documents with viewer
4. Add status timeline
5. Enable communication with broker
6. Add actions (add documents, request updates)

---

## Summary

The "Past Claims" feature is now fully integrated into the Client Portal. Clients can:
- View all their submitted claims in a clean, organized list
- See status at a glance with color-coded badges
- Access claim details (placeholder for now)
- Navigate seamlessly between portal views
- View summary statistics of their claims

The implementation follows existing design patterns, maintains security through RLS, and provides a solid foundation for future claim detail enhancements.
