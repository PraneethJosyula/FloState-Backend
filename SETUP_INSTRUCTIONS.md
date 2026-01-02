# Supabase Database Setup Instructions

## Option 1: Using Supabase Dashboard (Recommended - Easier)

### Step 1: Get Your Project Reference ID
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your **FloState** project
3. Go to **Settings** → **General**
4. Copy your **Project Reference ID** (looks like: `abcdefghijklmnop`)

### Step 2: Get Your Database Password
- If you remember it, great!
- If not, you can reset it in **Settings** → **Database**

### Step 3: Run Migrations via SQL Editor
1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**

3. **Run Migration 1** - Copy and paste the entire contents of `migrations/001_initial_schema.sql`
   - Click **Run** (or press Ctrl+Enter)
   - You should see "Success. No rows returned"

4. **Run Migration 2** - Copy and paste `migrations/002_handle_new_user_trigger.sql`
   - Click **Run**

5. **Run Migration 3** - Copy and paste `migrations/003_rls_policies.sql`
   - Click **Run**

6. **Run Migration 4** - Copy and paste `migrations/004_storage_setup.sql`
   - Click **Run**

### Step 4: Verify Setup
1. Go to **Table Editor** - You should see:
   - ✅ `profiles`
   - ✅ `activities`
   - ✅ `likes`
   - ✅ `follows`
   - ✅ `comments`

2. Go to **Storage** - You should see:
   - ✅ `evidence-images` bucket (public)

3. Go to **Database** → **Functions** - You should see:
   - ✅ `handle_new_user()` function

### Step 5: Get API Credentials
1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

3. Create `frontend/.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## Option 2: Using Supabase CLI

### Step 1: Login to Supabase
Open your terminal and run:
```bash
cd backend
npx supabase login
```
This will open a browser window for authentication.

### Step 2: Link Your Project
```bash
npx supabase link --project-ref your-project-ref-id
```
Replace `your-project-ref-id` with your Project Reference ID from Step 1 above.

### Step 3: Push Migrations
```bash
npx supabase db push
```

This will apply all migrations in the `migrations/` folder.

---

## Troubleshooting

### If migrations fail:
- Run them one at a time in the SQL Editor
- Check the error message - it will tell you what went wrong
- Common issues:
  - Tables already exist: Drop them first or use `DROP TABLE IF EXISTS`
  - Permission errors: Make sure you're using the SQL Editor (has full permissions)

### If storage bucket doesn't appear:
- Go to **Storage** → **New bucket**
- Name: `evidence-images`
- Public: ✅ Yes
- Or re-run migration 004

### If RLS policies conflict:
- Go to **Authentication** → **Policies**
- Delete existing policies manually
- Re-run migration 003

---

## Next Steps After Setup

1. ✅ Database is ready
2. ✅ Create `frontend/.env.local` with your credentials
3. ✅ Start building your app!

