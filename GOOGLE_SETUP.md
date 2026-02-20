# Google Cloud Console Setup Guide

Follow these steps to configure Google Sign-In and Google Sheets integration.

## 1. Create a Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown (top left) > **New Project**.
3. Name it `Docubot AI` (or similar) and click **Create**.
4. Select the new project.

## 2. Enable APIs
1. Go to **APIs & Services** > **Library**.
2. Search for and enable the following APIs:
   - **Google Sheets API** (for accessing sheets)
   - **Google Drive API** (optional, useful for file picker if added later)

## 3. Configure OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** (unless you have a Google Workspace organization) and click **Create**.
3. Fill in required fields:
   - **App Name**: `Docubot AI`
   - **User Support Email**: Your email.
   - **Developer Contact Information**: Your email.
4. Click **Save and Continue**.
5. **Scopes**: Click **Add or Remove Scopes**.
   - Select `.../auth/userinfo.email`
   - Select `.../auth/userinfo.profile`
   - Select `.../auth/spreadsheets.readonly` (for Sheets integration)
6. Click **Update**, then **Save and Continue**.
7. **Test Users**: Add your own Google email to the list (since app is in "Testing" mode).
8. Click **Save and Continue**.

## 4. Create Credentials
1. Go to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. **Application type**: Web application.
4. **Name**: `Docubot Web Client`.
5. **Authorized JavaScript origins**:
   - `http://localhost:3000`
6. **Authorized redirect URIs** (Add BOTH):
   - `http://localhost:3000/auth/callback` (For Login)
   - `http://localhost:3000/google-callback` (For Sheets Integration)
7. Click **Create**.

## 5. Update Environment Variables
Copy the **Client ID** and **Client Secret** and update `backend/.env`:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
# Redirect URI for sheets (Login URI is handled automatically)
GOOGLE_REDIRECT_URI=http://localhost:3000/google-callback
```

## 6. Restart Backend
Restart your backend server to apply the changes:
```bash
# In backend terminal
Ctrl+C
python -m uvicorn app.main:app --reload --port 8000
```
