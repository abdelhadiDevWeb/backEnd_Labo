# Backend Setup Guide

## Quick Start

1. **Create a `.env` file in the `server` directory** with the following variables:

```env
PORT=3001
JWT_SECRET=your-secret-jwt-key-here-change-this-in-production
REFRECHTOKEN=your-refresh-token-secret-change-this
SECRETSESSION=your-session-secret-change-this
URLFRONT=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/labo

# Email Configuration (for password reset)
# ⚠️ IMPORTANT: For Gmail, you MUST use an App Password, NOT your regular password!
# 
# Step-by-step Gmail App Password setup:
# 1. Go to your Google Account: https://myaccount.google.com/
# 2. Click "Security" in the left sidebar
# 3. Under "How you sign in to Google", enable "2-Step Verification" (if not already enabled)
# 4. After enabling 2-Step Verification, go to: https://myaccount.google.com/apppasswords
# 5. Select "Mail" as the app and "Other (Custom name)" as the device
# 6. Enter a name like "Market Lab Server" and click "Generate"
# 7. Copy the 16-character password (it will look like: abcd efgh ijkl mnop)
# 8. Remove the spaces and use it as SMTP_PASS (example: abcdefghijklmnop)
#
# If you see error "Application-specific password required", you're using your regular password!
# You MUST use the App Password from step 7 above.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password-without-spaces
```

**⚠️ CRITICAL FOR GMAIL:** 
- You CANNOT use your regular Gmail password
- You MUST generate an App Password (see steps above)
- The App Password is 16 characters (remove spaces when copying)
- If you get "Application-specific password required" error, you're using the wrong password!

2. **Start MongoDB** (if not already running)

3. **Install dependencies and run the server:**
```bash
cd server
bun install
bun run dev
```

You should see:
```
MongoDB Database "labo" Is Connected
server is runing on port 3001
```

## Important Notes

- The server runs on port **3001** by default
- Make sure MongoDB is running before starting the server
- If you change the PORT, update the frontend `.env.local` file accordingly

## Troubleshooting

### "Failed to fetch" Error
- Make sure the backend server is running (`bun run dev` in the server directory)
- Check that the port matches (default: 3001)
- Verify MongoDB is running and accessible

### CORS Errors
- The server is configured to accept requests from `http://localhost:3000`
- If you're using a different port, update the CORS configuration in `server/index.ts`

