# Railway Deployment Guide

This guide will help you deploy Gymble to Railway.

## Prerequisites

1. A GitHub account
2. A Railway account (sign up at [railway.app](https://railway.app))

## Step 1: Push Your Code to GitHub

1. Initialize git (if not already done):
```bash
git init
git add .
git commit -m "Initial commit"
```

2. Create a new repository on GitHub

3. Push your code:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Railway

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will automatically detect Next.js and start building

## Step 3: Configure Environment Variables

In your Railway project dashboard:

1. Go to the "Variables" tab
2. Add the following environment variables:

```
JWT_SECRET=your-super-secret-jwt-key-change-this-to-something-random
DATABASE_PATH=/data/gymble.db
NODE_ENV=production
PORT=3000
```

**Important**: 
- Generate a strong JWT_SECRET (you can use: `openssl rand -base64 32`)
- Railway will automatically set PORT, but it's good to have it explicit

## Step 4: Add Persistent Volume (for Database & Uploads)

1. In your Railway project, click "New" → "Volume"
2. Name it "data" and mount it to `/data`
3. This will persist your database and uploads across deployments

## Step 5: Update Database Path (if needed)

The database will be stored in the persistent volume at `/data/gymble.db`. The current configuration should work, but if you need to change it, update the `DATABASE_PATH` environment variable.

## Step 6: Configure Domain

1. In Railway, go to your service
2. Click "Settings" → "Generate Domain"
3. Railway will provide a free `.railway.app` domain
4. You can also add a custom domain if you have one

## Step 7: Verify Deployment

1. Visit your Railway domain
2. Register a new account
3. Test the features:
   - Login/Register
   - Upload photos
   - Add friends
   - Admin panel (if you're using username "admin" or "seuq")

## Troubleshooting

### Build Failures

#### Error: "npm ci" failed / "better-sqlite3" build error
This is usually due to native module compilation. Solutions:

1. **Check build logs** in Railway dashboard for specific error
2. **Ensure nixpacks.toml exists** - This file configures the build environment
3. **Try rebuilding** - Sometimes the first build fails, try redeploying
4. **Check Node version** - Railway should use Node 18+ automatically

If build still fails:
- Railway might need to compile `better-sqlite3` from source
- The `nixpacks.toml` file includes Python and build tools needed
- Make sure `package-lock.json` is committed to git

### Database Issues
- Make sure the persistent volume is mounted correctly
- Check that `DATABASE_PATH` is set to `/data/gymble.db`

### File Upload Issues
- Ensure the persistent volume is mounted
- Check that directories are created (the app does this automatically)

## Railway Free Tier Limits

- $5 credit per month
- 500 hours of usage
- Persistent storage included
- Custom domains supported

## Monitoring

- Check logs in Railway dashboard
- Monitor usage in the "Metrics" tab
- Set up alerts if needed

## Updating Your App

1. Push changes to GitHub
2. Railway will automatically redeploy
3. Your database and uploads persist across deployments

## Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

