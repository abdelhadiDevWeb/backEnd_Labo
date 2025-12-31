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
```

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

