# Backend - Supabase Migrations

This folder contains Supabase database migrations and configuration files.

## Setup Instructions

1. Install Supabase CLI (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. Initialize Supabase project (if starting fresh):
   ```bash
   supabase init
   ```

3. Link to your Supabase project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Apply migrations:
   ```bash
   supabase db push
   ```

## Migration Files

- `001_initial_schema.sql` - Creates all tables (profiles, activities, likes, follows)
- `002_handle_new_user_trigger.sql` - Creates trigger for auto-creating profiles
- `003_rls_policies.sql` - Sets up Row Level Security policies

