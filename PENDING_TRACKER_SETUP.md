# Automated Pending Presentation Tracker - Configuration

## Overview

The system now automatically tracks pending Gamma presentations and updates your Google Sheet when they complete.

---

## Required Environment Variables

Add these to your `.env.local` (local) and Vercel Dashboard (production):

### New Variables

```bash
# Cron Secret - Generate a random string for security
# Example: openssl rand -hex 32
CRON_SECRET=your_random_secret_here

# Tracking Sheets - JSON array of spreadsheet IDs to monitor
# Format: [{"id": "spreadsheet_id", "name": "display_name"}]
TRACKING_SHEETS=[{"id":"your_spreadsheet_id_here","name":"Subject Name"}]
```

### Existing Variables (already configured)

```bash
GEMINI_API_KEY=your_gemini_api_key
GAMMA_API_KEY=your_gamma_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/auth/callback
```

---

## How It Works

### 1. During Automation

When you run the automation:

**Completed Presentations** (< 60s):
```
| PPT Name           | Status      | Gamma URL        | Generation ID | Last Updated          |
|--------------------|-------------|------------------|---------------|-----------------------|
| Unit-1_Part-1      | ✅ Complete | https://gamma... | -             | 2025-11-28T00:00:00Z |
```

**Pending Presentations** (> 60s timeout):
```
| PPT Name           | Status      | Gamma URL | Generation ID    | Last Updated          |
|--------------------|-------------|-----------|------------------|-----------------------|
| Unit-2_Part-1      | ⏳ Pending  | -         | gen_abc123xyz    | 2025-11-28T00:05:00Z |
```

### 2. Automated Checking

Every 10 minutes, the cron job:
1. Reads all tracking sheets from `TRACKING_SHEETS`
2. Finds rows with status "⏳ Pending"
3. Checks their Gamma generation ID
4. Updates the sheet when complete:

```
| PPT Name           | Status      | Gamma URL        | Generation ID | Last Updated          |
|--------------------|-------------|------------------|---------------|-----------------------|
| Unit-2_Part-1      | ✅ Complete | https://gamma... | -             | 2025-11-28T00:15:00Z |
```

---

## Setup Instructions

### Step 1: Generate CRON_SECRET

```bash
# On Mac/Linux
openssl rand -hex 32

# Or use any random string generator
# Example output: a1b2c3d4e5f6...
```

Add to `.env.local`:
```bash
CRON_SECRET=a1b2c3d4e5f6g7h8i9j0...
```

### Step 2: Configure Tracking Sheets

After your first automation run, copy the spreadsheet ID:

**From URL**: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

Add to `.env.local`:
```bash
TRACKING_SHEETS=[{"id":"1AbC...XyZ","name":"Economics Course"}]
```

**Multiple sheets**:
```bash
TRACKING_SHEETS=[{"id":"id1","name":"Economics"},{"id":"id2","name":"Physics"}]
```

### Step 3: Deploy to Vercel

1. Push code to GitHub
2. Vercel will auto-deploy
3. Add environment variables in Vercel Dashboard:
   - Settings → Environment Variables
   - Add `CRON_SECRET`
   - Add `TRACKING_SHEETS`
4. Redeploy

### Step 4: Verify Cron Job

Check Vercel Dashboard:
- Deployments → Cron Jobs
- Should show: `/api/cron/check-pending` running every 10 minutes

---

## Manual Testing

### Test Cron Endpoint Locally

```bash
# Start dev server
npm run dev

# In another terminal, call the cron endpoint
curl -X GET http://localhost:3000/api/cron/check-pending \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected response:
```json
{
  "success": true,
  "timestamp": "2025-11-28T00:00:00.000Z",
  "totalChecked": 2,
  "totalUpdated": 1,
  "results": [
    {
      "sheetName": "Economics Course",
      "checked": 2,
      "updated": 1
    }
  ]
}
```

---

## Cron Schedule

**Current**: `*/10 * * * *` (every 10 minutes)

**Alternative schedules**:
- Every 5 minutes: `*/5 * * * *`
- Every 15 minutes: `*/15 * * * *`
- Every hour: `0 * * * *`

Update in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/check-pending",
    "schedule": "*/10 * * * *"
  }]
}
```

---

## Troubleshooting

### Cron not running

1. Check Vercel Dashboard → Cron Jobs
2. View logs: Deployments → Functions → `/api/cron/check-pending`
3. Verify `CRON_SECRET` is set correctly

### Sheets not updating

1. Check cron logs for errors
2. Verify spreadsheet ID in `TRACKING_SHEETS`
3. Ensure Google OAuth tokens are valid
4. Check Generation ID is correct in sheet

### 401 Unauthorized

- Verify `CRON_SECRET` matches in request and environment variable
- Vercel automatically adds `Bearer` token to cron requests

---

## Monitoring

### Vercel Dashboard

View cron execution logs:
1. Go to Vercel Dashboard
2. Select your project
3. Deployments → Functions
4. Filter by `/api/cron/check-pending`

### Expected Log Output

```
Starting cron job: Checking pending presentations...
Checking sheet: Economics Course (1AbC...XyZ)
Checking generation: gen_abc123xyz
Generation gen_abc123xyz status: done
✅ Generation gen_abc123xyz completed: https://gamma.app/...
Updated 1 rows in Economics Course
Cron job completed: Checked 2, Updated 1
```

---

## Security Notes

- ✅ Cron endpoint requires `CRON_SECRET` header
- ✅ Only Vercel can call cron jobs automatically
- ✅ Spreadsheet IDs are in environment variables only
- ✅ Gamma API key is server-side only

---

## Cost Considerations

**Vercel Hobby Plan**:
- ✅ Cron jobs included (100,000 invocations/month)
- ✅ 10-minute intervals = ~4,320 calls/month (well under limit)

**Vercel Pro Plan**:
- ✅ 1,000,000 invocations/month
- ✅ Better logging and monitoring

---

## Future Enhancements

Consider adding:
1. **Email notifications** when presentations complete
2. **Webhook from Gamma** instead of polling
3. **Database storage** for better tracking
4. **Frontend UI** to view pending status

---

## Quick Reference

| Action | Command |
|--------|---------|
| Generate secret | `openssl rand -hex 32` |
| Test locally | `curl -H "Authorization: Bearer SECRET" localhost:3000/api/cron/check-pending` |
| View logs | Vercel Dashboard → Functions → check-pending |
| Update schedule | Edit `vercel.json` → `crons.schedule` |
| Add tracking sheet | Update `TRACKING_SHEETS` env var |

---

## Manual Update (Backup Option)

### Purpose

If the cron job fails or you want to manually check pending presentations, use the built-in manual update feature.

### How to Use

1. **Navigate to the app** (`http://localhost:3000` or your deployed URL)
2. **Authenticate with Google** if not already authenticated
3. **Scroll to "Check Pending Presentations"** section (at the bottom)
4. **Enter your tracking spreadsheet**:
   - Paste the full URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - OR just the ID: `SPREADSHEET_ID`
5. **Click "Check Pending Status"**
6. **View results**:
   - Shows how many were checked
   - Displays updated presentations
   - Provides direct links to completed presentations

### API Endpoint

You can also call the API directly:

```bash
curl -X POST http://localhost:3000/api/update-pending \
  -H "Content-Type: application/json" \
  -d '{
    "spreadsheetId": "YOUR_SPREADSHEET_ID",
    "googleTokens": {...}
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Checked 3 pending presentations, updated 2",
  "totalChecked": 3,
  "updated": 2,
  "updates": [
    {
      "name": "Unit-2_Part-1",
      "status": "✅ Complete",
      "url": "https://gamma.app/..."
    }
  ]
}
```

### When to Use Manual Update

- ✅ Cron job hasn't run yet (10-minute interval)
- ✅ Want immediate results instead of waiting
- ✅ Troubleshooting cron job issues
- ✅ One-time check for a specific sheet
