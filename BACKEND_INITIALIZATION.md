# FocusFlow Backend Initialization Guide

## Overview

This guide covers the complete setup and initialization of the FocusFlow backend using Supabase. The backend consists of database migrations, Row Level Security policies, storage configuration, and authentication setup.

---

## Prerequisites

- Supabase account ([supabase.com](https://supabase.com))
- Supabase project created
- Node.js 18+ installed (for CLI usage)
- Supabase CLI installed (optional, for local development)

---

## Initialization Steps

### Step 1: Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Project Name:** `FloState` (or your preferred name)
   - **Database Password:** Create a strong password (save it securely)
   - **Region:** Choose closest to your users
   - **Pricing Plan:** Free tier is sufficient for MVP
4. Wait for project creation (~2 minutes)

---

### Step 2: Get Project Credentials

1. In your project dashboard, go to **Settings** → **API**
2. Copy and save:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)
   - **service_role** key (keep secret, for admin operations)

3. Go to **Settings** → **General**
   - Copy **Project Reference ID** (for CLI linking)

---

### Step 3: Run Database Migrations

You have two options: **Dashboard (Recommended)** or **CLI**.

#### Option A: Using Supabase Dashboard (Easiest)

1. Go to **SQL Editor** in your Supabase dashboard
2. Click **"New Query"**

3. **Run Migration 1: Initial Schema**
   - Open `backend/supabase/migrations/20260101233542_initial_schema.sql`
   - Copy entire contents
   - Paste into SQL Editor
   - Click **"Run"** (or Ctrl+Enter)
   - Verify: "Success. No rows returned"

4. **Run Migration 2: User Trigger**
   - Open `backend/supabase/migrations/20260101233600_handle_new_user_trigger.sql`
   - Copy and run in SQL Editor

5. **Run Migration 3: RLS Policies**
   - Open `backend/supabase/migrations/20260101233613_rls_policies.sql`
   - Copy and run in SQL Editor

6. **Run Migration 4: Storage Setup**
   - Open `backend/supabase/migrations/20260101233648_storage_setup.sql`
   - Copy and run in SQL Editor

#### Option B: Using Supabase CLI

1. **Install Supabase CLI** (if not installed):
   ```bash
   # Windows (using Scoop)
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   
   # Or use npx (no installation needed)
   npx supabase --version
   ```

2. **Login to Supabase:**
   ```bash
   cd backend
   npx supabase login
   ```
   This opens a browser for authentication.

3. **Link Your Project:**
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF_ID
   ```
   Replace `YOUR_PROJECT_REF_ID` with your Project Reference ID from Step 2.

4. **Push Migrations:**
   ```bash
   npx supabase db push
   ```
   Confirm when prompted.

---

### Step 4: Verify Database Setup

#### Check Tables

1. Go to **Table Editor** in Supabase dashboard
2. Verify these tables exist:
   - ✅ `profiles`
   - ✅ `activities`
   - ✅ `likes`
   - ✅ `follows`
   - ✅ `comments`

#### Check Functions

1. Go to **Database** → **Functions**
2. Verify:
   - ✅ `handle_new_user()` function exists

#### Check Storage

1. Go to **Storage**
2. Verify:
   - ✅ `evidence-images` bucket exists
   - ✅ Bucket is set to **Public**

#### Check RLS Policies

1. Go to **Authentication** → **Policies**
2. Verify RLS is enabled on all tables:
   - ✅ `profiles` - Multiple policies
   - ✅ `activities` - Multiple policies
   - ✅ `likes` - Multiple policies
   - ✅ `follows` - Multiple policies
   - ✅ `comments` - Multiple policies

---

### Step 5: Configure Authentication

1. Go to **Authentication** → **Providers**
2. **Email Provider** (enabled by default):
   - ✅ Email enabled
   - Configure email templates if needed

3. **Optional: Social Providers**
   - Enable Google, GitHub, etc. if desired
   - Configure OAuth credentials

4. **URL Configuration:**
   - Go to **Authentication** → **URL Configuration**
   - Set **Site URL:** `http://localhost:3000` (for development)
   - Add **Redirect URLs:** 
     - `http://localhost:3000/**`
     - `https://yourdomain.com/**` (for production)

---

### Step 6: Configure Storage Policies (Verify)

Storage policies are set up in migration 4, but verify:

1. Go to **Storage** → **Policies** → `evidence-images`
2. Verify policies:
   - ✅ "Public can view evidence images" (SELECT)
   - ✅ "Authenticated users can upload evidence images" (INSERT)
   - ✅ "Users can update own evidence images" (UPDATE)
   - ✅ "Users can delete own evidence images" (DELETE)

---

### Step 7: Set Up Environment Variables

Create `frontend/.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: For server-side operations
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Important:** 
- Never commit `.env.local` to git
- Use `NEXT_PUBLIC_` prefix for client-side variables
- Keep `SUPABASE_SERVICE_ROLE_KEY` secret (server-side only)

---

### Step 8: Test Database Connection

Create a test file `frontend/test-connection.ts`:

```typescript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

async function testConnection() {
  // Test: Fetch profiles (should work even if empty)
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Connection failed:', error);
  } else {
    console.log('✅ Database connection successful!');
  }
}

testConnection();
```

Run: `npx tsx test-connection.ts` (or add to a test page)

---

## Migration Management

### View Applied Migrations

```bash
cd backend
npx supabase migration list
```

### Create New Migration

```bash
npx supabase migration new migration_name
```

This creates a timestamped file in `backend/supabase/migrations/`.

### Rollback Migration

**Note:** Supabase doesn't support automatic rollbacks. You must:
1. Create a new migration to undo changes
2. Or manually fix via SQL Editor

### Reset Database (Development Only)

```bash
npx supabase db reset
```

**Warning:** This deletes all data!

---

## Troubleshooting

### Migration Fails

**Error: "relation already exists"**
- Tables may already exist from previous runs
- Solution: Drop tables manually or use `DROP TABLE IF EXISTS` in migration

**Error: "permission denied"**
- RLS policies may be blocking
- Solution: Check RLS policies, ensure you're authenticated

**Error: "function does not exist"**
- UUID extension issue
- Solution: Ensure `uuid-ossp` extension is enabled

### Storage Upload Fails

**Error: "new row violates row-level security policy"**
- Storage policy issue
- Solution: Verify storage policies are correct, check folder structure

### Authentication Issues

**Error: "Invalid API key"**
- Wrong credentials in `.env.local`
- Solution: Double-check Project URL and anon key

**Error: "Email not confirmed"**
- User needs to confirm email
- Solution: Check email provider settings, disable email confirmation for development

---

## Production Checklist

Before deploying to production:

- [ ] Update Site URL in Supabase dashboard
- [ ] Add production redirect URLs
- [ ] Configure custom domain (if applicable)
- [ ] Set up email templates
- [ ] Enable rate limiting (Supabase handles this)
- [ ] Review RLS policies
- [ ] Set up database backups
- [ ] Configure CORS if needed
- [ ] Test all authentication flows
- [ ] Verify storage bucket permissions

---

## Local Development Setup (Optional)

For local Supabase development:

1. **Start Local Supabase:**
   ```bash
   cd backend
   npx supabase start
   ```

2. **Get Local Credentials:**
   ```bash
   npx supabase status
   ```

3. **Use Local URLs in `.env.local`:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
   ```

4. **Stop Local Supabase:**
   ```bash
   npx supabase stop
   ```

---

## Database Backup & Restore

### Create Backup

Via Supabase Dashboard:
1. Go to **Settings** → **Database**
2. Click **"Create backup"**
3. Download backup file

Via CLI:
```bash
npx supabase db dump -f backup.sql
```

### Restore Backup

Via SQL Editor:
1. Open SQL Editor
2. Paste backup SQL
3. Run

Via CLI:
```bash
npx supabase db reset
psql -h localhost -U postgres -d postgres < backup.sql
```

---

## Monitoring & Maintenance

### Database Monitoring

- **Supabase Dashboard** → **Database** → **Reports**
- Monitor:
  - Query performance
  - Database size
  - Connection pool usage

### Storage Monitoring

- **Supabase Dashboard** → **Storage**
- Monitor:
  - Storage usage
  - File count
  - Bandwidth usage

### Authentication Monitoring

- **Supabase Dashboard** → **Authentication** → **Users**
- Monitor:
  - User signups
  - Active sessions
  - Failed login attempts

---

## Security Best Practices

1. **Never expose service_role key** in client-side code
2. **Use RLS policies** for all data access
3. **Validate inputs** before database operations
4. **Use parameterized queries** (Supabase handles this)
5. **Enable email confirmation** in production
6. **Set up rate limiting** (Supabase provides this)
7. **Regular security audits** of RLS policies
8. **Monitor for suspicious activity**

---

## Support & Resources

- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)
- **Supabase Discord:** [discord.supabase.com](https://discord.supabase.com)
- **Migration Guide:** [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli)
- **RLS Guide:** [supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security)

---

## Next Steps

After initialization:

1. ✅ Database is ready
2. ✅ Create frontend `.env.local` file
3. ✅ Implement service layer functions
4. ✅ Build frontend components
5. ✅ Test end-to-end flows
6. ✅ Deploy to production

Your backend is now initialized and ready for development! 🚀

