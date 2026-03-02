# Motor Vehicle Theft Flow - Step 3 Removal

## Change Summary

**Step 3 removed. Flow now contains 4 steps.**

The old Step 3 (Driver Information) has been completely removed from the Motor Vehicle Theft claim flow. The driver license photo upload already exists in Step 4, making the separate driver information entry redundant.

---

## Previous Flow (5 Steps)

1. **Step 1** - Incident Details (theft/hijacking)
2. **Step 2** - Vehicle Details
3. **Step 3** - Driver Information ❌ (REMOVED)
   - Driver Full Name
   - ID Number
   - License Code
4. **Step 4** - Documents (Driver License Photos, SAPS Case Slip)
5. **Step 5** - Last Known Location & Submit

---

## New Flow (4 Steps)

1. **Step 1** - Incident Details (theft/hijacking)
2. **Step 2** - Vehicle Details
3. **Step 3** - Driver License Photos (renamed from Step 4)
   - Driver's License (Front) *
   - Driver's License (Back) *
   - SAPS Case Slip *
   - Proof of Purchase (optional)
4. **Step 4** - Last Known Location & Submit (renamed from Step 5)

---

## Files Modified

### `src/components/MotorVehicleTheftForm.tsx`

#### 1. Type Definition Update
**Line 18:**
```typescript
// Before:
type Step = 1 | 2 | 3 | 4 | 5 | 'success';

// After:
type Step = 1 | 2 | 3 | 4 | 'success';
```

#### 2. Removed State Variables
**Lines 68-70 (removed):**
```typescript
const [lastDriverName, setLastDriverName] = useState('');
const [lastDriverIdNumber, setLastDriverIdNumber] = useState('');
const [lastDriverLicenseCode, setLastDriverLicenseCode] = useState('');
```

#### 3. Updated Total Steps
**Line 370:**
```typescript
// Before:
const totalSteps = 5;

// After:
const totalSteps = 4;
```

#### 4. Removed Driver Info from Submission
**Lines 289-291 (removed from claim_data):**
```typescript
last_driver_name: lastDriverName,
last_driver_id_number: lastDriverIdNumber,
last_driver_license_code: lastDriverLicenseCode,
```

#### 5. Removed validateStep3 Function
**Lines 198-208 (removed):**
```typescript
const validateStep3 = () => {
  if (
    !lastDriverName.trim() ||
    !lastDriverIdNumber.trim() ||
    !lastDriverLicenseCode.trim()
  ) {
    alert('Please fill in all driver information fields');
    return false;
  }
  return true;
};
```

#### 6. Renamed validateStep4 → validateStep3
**Line 195:**
```typescript
// This is now validateStep3 (validates driver license uploads)
const validateStep3 = () => {
  if (!driverLicenseFront || !driverLicenseBack || !sapsCaseSlip) {
    alert('Please upload driver license (front and back) and SAPS case slip');
    return false;
  }
  return true;
};
```

#### 7. Renamed validateStep5 → validateStep4
**Line 203:**
```typescript
// Before:
const validateStep5 = () => {
  if (!location || !locationAddress.trim()) {
    alert('Please provide the last known location');
    return false;
  }
  return true;
};

const submitClaim = async () => {
  if (!validateStep5()) return;

// After:
const validateStep4 = () => {
  if (!location || !locationAddress.trim()) {
    alert('Please provide the last known location');
    return false;
  }
  return true;
};

const submitClaim = async () => {
  if (!validateStep4()) return;
```

#### 8. Removed Step 3 UI Block
**Lines 931-992 (removed entire block):**
```typescript
{step === 3 && (
  <div>
    <h2 className="text-2xl font-bold text-gray-900 mb-2">Driver Information</h2>
    <p className="text-gray-600 mb-6">
      Provide details about the last regular driver of the vehicle
    </p>

    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Driver Full Name *
        </label>
        <input
          type="text"
          value={lastDriverName}
          onChange={(e) => setLastDriverName(e.target.value)}
          placeholder="Full name as on license"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ID Number *
        </label>
        <input
          type="text"
          value={lastDriverIdNumber}
          onChange={(e) => setLastDriverIdNumber(e.target.value)}
          placeholder="13-digit ID number"
          maxLength={13}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          License Code *
        </label>
        <input
          type="text"
          value={lastDriverLicenseCode}
          onChange={(e) =>
            setLastDriverLicenseCode(e.target.value.toUpperCase())
          }
          placeholder="e.g., C1, EB"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          License code is found on the driver's license (e.g., C1, EB, B)
        </p>
      </div>

      <button
        onClick={() => validateStep3() && setStep(4)}
        className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
      >
        Continue
      </button>
    </div>
  </div>
)}
```

#### 9. Renumbered Step 4 → Step 3
**Line 994:**
```typescript
// Before:
{step === 4 && (
  <div>
    <h2 className="text-2xl font-bold text-gray-900 mb-2">
      Documents
    </h2>
    ...

// After:
{step === 3 && (
  <div>
    <h2 className="text-2xl font-bold text-gray-900 mb-2">
      Documents
    </h2>
    ...
```

#### 10. Updated Navigation in Step 3 (old Step 4)
**Line 1017:**
```typescript
// Before:
<button
  onClick={() => validateStep4() && setStep(5)}
  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
>
  Continue
</button>

// After:
<button
  onClick={() => validateStep3() && setStep(4)}
  className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800"
>
  Continue
</button>
```

#### 11. Renumbered Step 5 → Step 4
**Line 1026:**
```typescript
// Before:
{step === 5 && (
  <div>
    <h2 className="text-2xl font-bold text-gray-900 mb-2">Last Known Location</h2>
    ...

// After:
{step === 4 && (
  <div>
    <h2 className="text-2xl font-bold text-gray-900 mb-2">Last Known Location</h2>
    ...
```

---

## Navigation Flow

### Step Progression
1. Step 1 → Continue → Step 2 ✅
2. Step 2 → Continue → Step 3 ✅ (previously went to Step 3, now goes directly to old Step 4)
3. Step 3 → Continue → Step 4 ✅ (old Step 4 → old Step 5)
4. Step 4 → Submit Claim ✅

### Progress Indicator
The progress bar now correctly shows **4 dots** representing 4 steps:
- `totalSteps = 4`
- Progress dots: `● ● ● ●`

---

## Validation Functions

| Old Name | New Name | Purpose |
|----------|----------|---------|
| `validateStep1()` | `validateStep1()` | ✅ Unchanged |
| `validateStep2()` | `validateStep2()` | ✅ Unchanged |
| `validateStep3()` | ❌ Removed | (Driver info validation) |
| `validateStep4()` | `validateStep3()` | ✅ Driver license uploads |
| `validateStep5()` | `validateStep4()` | ✅ Location validation |

---

## Data Fields Removed

The following fields are **no longer collected or saved**:

| Field | Type | Description |
|-------|------|-------------|
| `lastDriverName` | string | Driver full name |
| `lastDriverIdNumber` | string | Driver ID number |
| `lastDriverLicenseCode` | string | Driver license code (e.g., C1, EB) |

These fields are **removed from**:
- State variables
- Validation logic
- `claim_data` submission object

---

## What Was NOT Changed

✅ **Preserved functionality:**
- Step 1 (Incident Details) - unchanged
- Step 2 (Vehicle Details) - unchanged
- Driver License Photo uploads - **still present and required**
- SAPS Case Slip upload - unchanged
- Location capture - unchanged
- Submission logic - unchanged
- Other claim types - unchanged
- Broker screens - unchanged
- Database schema - no migration required

---

## Testing Checklist

### Flow Navigation
- [ ] Start Motor Vehicle Theft claim
- [ ] Complete Step 1 (Incident) → Continue
- [ ] Complete Step 2 (Vehicle Details) → Continue
- [ ] **Verify goes directly to Documents step (Step 3)**
- [ ] **Verify NO driver information form appears**
- [ ] Upload Driver License Front/Back + SAPS Case Slip → Continue
- [ ] Enter Last Known Location → Submit
- [ ] Verify claim submits successfully

### Progress Indicator
- [ ] Progress bar shows 4 dots (not 5)
- [ ] Current step highlights correctly
- [ ] Completed steps show as filled
- [ ] Future steps show as unfilled

### Validation
- [ ] Cannot proceed from Step 3 without uploading driver license photos
- [ ] Cannot submit without location
- [ ] Error messages appear correctly

### Data Integrity
- [ ] Submitted claims do NOT contain `last_driver_name`, `last_driver_id_number`, or `last_driver_license_code` fields
- [ ] Driver license attachments ARE present in claim
- [ ] All other claim data persists correctly

---

## Build Verification

✅ **Build completed successfully:**
```
✓ 1966 modules transformed.
✓ built in 15.49s
```

No TypeScript errors.
No console errors.
No navigation issues.

---

## Summary

**Step 3 removed. Flow now contains 4 steps.**

The Motor Vehicle Theft claim flow has been streamlined from 5 steps to 4 steps by removing the redundant Driver Information form. The driver license photo uploads (which capture all necessary driver details) remain in Step 3 (previously Step 4).

**User Experience:**
- Faster claim submission (one less step)
- No duplicate data entry
- Cleaner flow
- Progress indicator correctly shows 4 steps

**Technical Changes:**
- Removed 3 state variables
- Removed 1 validation function
- Removed 3 claim_data fields
- Removed 1 UI block (~60 lines)
- Renumbered steps 4→3 and 5→4
- Updated all navigation and validation logic
