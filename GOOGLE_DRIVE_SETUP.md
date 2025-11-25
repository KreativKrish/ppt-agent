# Google Drive API Setup Guide

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a project" → "New Project"
3. Enter project name: **PPT Agent**
4. Click "Create"

## Step 2: Enable Required APIs

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Google Drive API**
   - **Google Sheets API** (for reading Excel files)

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type → Click "Create"
3. Fill in the form:
   - **App name**: PPT Agent
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Click "Save and Continue"
5. **Scopes**: Click "Add or Remove Scopes"
   - Add: `https://www.googleapis.com/auth/drive.readonly`
   - Add: `https://www.googleapis.com/auth/drive.file`
6. Click "Save and Continue"
7. **Test users**: Add your Google account email
8. Click "Save and Continue"

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: **PPT Agent Web Client**
5. **Authorized redirect URIs**: Add
   ```
   http://localhost:3000/api/auth/google/callback
   ```
6. Click "Create"
7. **Download the JSON file** (you'll need the Client ID and Client Secret)

## Step 5: Add Credentials to .env.local

Open your `.env.local` file and add:

```env
# Google Drive API
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
```

Replace the placeholder values with:
- **GOOGLE_CLIENT_ID**: From the downloaded JSON (`client_id`)
- **GOOGLE_CLIENT_SECRET**: From the downloaded JSON (`client_secret`)
- **GEMINI_API_KEY**: Your Gemini API key

## Step 6: Get Google Drive File/Folder IDs

### To get a File ID:
1. Open the file in Google Drive
2. Look at the URL: `https://drive.google.com/file/d/FILE_ID_HERE/view`
3. Copy the `FILE_ID_HERE` part

### To get a Folder ID:
1. Open the folder in Google Drive
2. Look at the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
3. Copy the `FOLDER_ID_HERE` part

## Troubleshooting

### "Access blocked: This app's request is invalid"
- Make sure you added your email to "Test users" in OAuth consent screen
- Verify the redirect URI matches exactly

### "insufficient permissions"
- Check that you enabled both Drive API and Sheets API
- Verify the scopes include `drive.readonly` and `drive.file`

### "invalid_grant"
- Delete stored tokens and re-authenticate
- Check that credentials haven't expired

## Next Steps

Once you've completed this setup:
1. Save your `.env.local` file
2. Restart the development server
3. The app will be ready to authenticate with Google Drive
