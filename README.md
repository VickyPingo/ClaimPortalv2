# Insurance Claims SaaS Platform

A professional, multi-tenant insurance claims management system designed for resale to multiple brokerages. Built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

### Multi-Tenancy
- Complete data isolation between brokerages
- Each brokerage has a unique ID
- All claims and clients are linked to specific brokerages
- No data leakage between businesses

### Client Portal (Mobile-First)
- Dynamic, branching claim form based on incident type
- Two incident types supported:
  - **Motor Accident**: Scene photos + third party details
  - **Burst Geyser**: Leak video + serial number photo
- Voice note recording with AI transcription
- Real-time GPS location capture
- SMS OTP verification for submission

### Broker Dashboard (Desktop)
- Secure phone-based authentication
- Searchable claims list with status indicators (New, Investigating, Resolved)
- Detailed claim view with:
  - Interactive GPS map
  - All uploaded media files
  - AI-translated English transcript of voice statements
  - Full incident details
- Real-time status management
- White-labeling settings:
  - Custom logo upload
  - Brand color customization

### AI Integration
- OpenAI Whisper for voice transcription
- Automatic translation from Afrikaans to English
- Graceful fallback if API is unavailable

### Security
- Row Level Security (RLS) on all tables
- Multi-tenant security at database level
- Secure file storage with access controls
- Phone-based authentication via SMS OTP

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Icons**: Lucide React
- **AI**: OpenAI Whisper API + GPT-4 for translation

## Getting Started

### Authentication Setup

The platform uses phone-based SMS OTP authentication. To test:

1. **For Client Portal**:
   - Click "File a Claim"
   - Enter your phone number (format: +27XXXXXXXXX)
   - Receive and enter the 6-digit OTP code
   - You'll be automatically registered as a client

2. **For Broker Dashboard**:
   - Click "Broker Login"
   - Use your registered broker phone number
   - Enter the OTP code

Note: Broker users must be manually created in the database with proper brokerage associations.

### Database Structure

#### Brokerages
- Stores brokerage company information
- Logo and brand color for white-labeling

#### Broker Users
- Staff members linked to their brokerage
- Can view and manage all claims for their brokerage

#### Clients
- End users who file claims
- Linked to specific brokerage
- Automatically created on first login

#### Claims
- Main claim records with full multi-tenancy
- Supports two incident types with different data requirements
- Includes GPS location, media files, voice notes, and transcripts

### Storage Buckets

- **claims**: Stores all claim-related media (photos, videos, voice notes)
- **branding**: Stores brokerage logos for white-labeling

### Edge Functions

- **transcribe-voice**: Handles voice note transcription and translation using OpenAI APIs

## White-Labeling

Brokers can customize their brand appearance:

1. Navigate to Settings in the Broker Dashboard
2. Upload your company logo
3. Choose your brand color
4. Preview changes before saving

These customizations will be applied to the client portal for your brokerage.

## Multi-Tenant Architecture

The platform ensures complete data isolation:

- Every table includes a `brokerage_id` foreign key
- RLS policies filter all queries by brokerage
- Clients can only see their own claims
- Brokers can only see claims from their brokerage
- No cross-brokerage data access is possible

## Development

### Build
```bash
npm run build
```

### Type Check
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

## Production Considerations

1. **Phone Authentication**: Ensure Supabase phone auth is properly configured with a valid SMS provider
2. **OpenAI API**: Add your OpenAI API key to Supabase Edge Function secrets for voice transcription
3. **Storage**: Configure appropriate storage limits per brokerage
4. **Monitoring**: Set up error tracking and performance monitoring
5. **Scaling**: Database indexes are in place for common queries

## Future Enhancements

- Email notifications for claim status updates
- Advanced analytics and reporting
- Document generation (PDF reports)
- Integration with insurance carrier APIs
- Mobile native apps (iOS/Android)
- Multi-language support
- Advanced search and filtering
- Claim assignment workflow
