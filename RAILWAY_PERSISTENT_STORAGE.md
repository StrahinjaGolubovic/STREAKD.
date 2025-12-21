# Fix: Database Resetting on Railway

If your database is being reset after each deployment, it means the database isn't being stored in the persistent volume. Follow these steps:

## Step 1: Create Persistent Volume

1. In your Railway project dashboard
2. Click **"New"** → **"Volume"**
3. Name: `data`
4. Mount Path: `/data`
5. Click **"Add"**

## Step 2: Attach Volume to Your Service

1. After creating the volume, click on it
2. Click **"Attach"** or **"Connect"**
3. Select your service (the deployed app)
4. The volume should now be attached

## Step 3: Set Environment Variables

1. Go to your service → **"Variables"** tab
2. Make sure you have:
   ```
   DATABASE_PATH=/data/gymble.db
   ```
3. If it's not set or set to something else, add/update it

## Step 4: Verify Volume is Mounted

1. In your service, go to **"Settings"** → **"Volumes"**
2. You should see the `data` volume mounted at `/data`
3. If not, make sure it's attached (see Step 2)

## Step 5: Redeploy

After setting up the volume and environment variable:
1. Railway will automatically redeploy
2. Or trigger a manual redeploy from the **"Deployments"** tab

## Important Notes

- **The database file must be at `/data/gymble.db`** for it to persist
- **Uploads and profiles** are currently stored in `public/uploads` and `public/profiles` which are NOT persistent
- If you want uploads to persist too, we need to update the code to store them in `/data/uploads` and `/data/profiles`

## Verify It's Working

1. Create a test account
2. Make some changes (upload photos, add friends)
3. Trigger a redeploy (push a small change)
4. Check if your account and data still exist after redeploy

If the database still resets, the volume might not be properly attached or the DATABASE_PATH is incorrect.

