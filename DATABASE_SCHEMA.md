# FocusFlow Database Schema Documentation

## Overview

The FocusFlow database uses PostgreSQL via Supabase with Row Level Security (RLS) enabled on all tables. The schema supports user profiles, activity tracking, social interactions (likes, comments, follows), and media storage.

---

## Tables

### 1. `profiles`

Stores user profile information linked to Supabase Auth users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, FK → `auth.users(id)` | User ID from Supabase Auth |
| `username` | TEXT | UNIQUE, NOT NULL | Unique username for the user |
| `full_name` | TEXT | NULLABLE | User's display name |
| `avatar_url` | TEXT | NULLABLE | URL to user's profile picture |
| `bio` | TEXT | NULLABLE | User biography/description |
| `theme_preference` | TEXT | DEFAULT 'system', CHECK | Theme preference: 'light', 'dark', or 'system' |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last profile update timestamp |

**Indexes:**
- `idx_profiles_username` on `username` (for fast username lookups)

**Relationships:**
- One-to-many with `activities` (user_id)
- One-to-many with `likes` (user_id)
- One-to-many with `comments` (user_id)
- Many-to-many with `follows` (follower_id, following_id)

---

### 2. `activities`

Stores productivity sessions/activities posted by users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique activity ID |
| `user_id` | UUID | NOT NULL, FK → `profiles(id)` | Creator of the activity |
| `category` | TEXT | NOT NULL | Activity category (e.g., "Deep Work", "Reading", "Coding") |
| `duration_minutes` | INTEGER | NOT NULL | Duration of the activity in minutes |
| `note` | TEXT | NULLABLE | Description/notes about the activity |
| `evidence_url` | TEXT | NULLABLE | URL to evidence image/media |
| `focus_level` | INTEGER | NULLABLE, CHECK (1-10) | Focus level rating (1-10 scale) |
| `visibility` | TEXT | DEFAULT 'public', CHECK | Visibility: 'public' or 'private' |
| `share_count` | INTEGER | DEFAULT 0 | Number of times activity was shared |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Activity creation timestamp |

**Indexes:**
- `idx_activities_user_id` on `user_id` (for user activity queries)
- `idx_activities_created_at` on `created_at DESC` (for feed ordering)

**Relationships:**
- Many-to-one with `profiles` (user_id)
- One-to-many with `likes` (activity_id)
- One-to-many with `comments` (activity_id)

**Business Rules:**
- `focus_level` must be between 1 and 10 if provided
- `visibility` must be either 'public' or 'private'
- Activities are automatically posted when created (no draft state)

---

### 3. `likes`

Junction table for user likes on activities. Prevents duplicate likes via composite primary key.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `activity_id` | UUID | NOT NULL, FK → `activities(id)` | Liked activity |
| `user_id` | UUID | NOT NULL, FK → `profiles(id)` | User who liked |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Like timestamp |
| **PRIMARY KEY** | (activity_id, user_id) | | Composite key prevents duplicates |

**Indexes:**
- `idx_likes_activity_id` on `activity_id` (for activity like counts)
- `idx_likes_user_id` on `user_id` (for user like queries)

**Relationships:**
- Many-to-one with `activities` (activity_id)
- Many-to-one with `profiles` (user_id)

---

### 4. `follows`

Junction table for user follow relationships. Users cannot follow themselves.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `follower_id` | UUID | NOT NULL, FK → `profiles(id)` | User who follows |
| `following_id` | UUID | NOT NULL, FK → `profiles(id)` | User being followed |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Follow timestamp |
| **PRIMARY KEY** | (follower_id, following_id) | | Composite key prevents duplicates |
| **CHECK** | follower_id != following_id | | Users cannot follow themselves |

**Indexes:**
- `idx_follows_follower_id` on `follower_id` (for "who I follow" queries)
- `idx_follows_following_id` on `following_id` (for "who follows me" queries)

**Relationships:**
- Many-to-one with `profiles` (follower_id, following_id)

---

### 5. `comments`

Stores comments on activities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique comment ID |
| `activity_id` | UUID | NOT NULL, FK → `activities(id)` | Activity being commented on |
| `user_id` | UUID | NOT NULL, FK → `profiles(id)` | Comment author |
| `text` | TEXT | NOT NULL | Comment content |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Comment creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last comment update timestamp |

**Indexes:**
- `idx_comments_activity_id` on `activity_id` (for activity comment queries)

**Relationships:**
- Many-to-one with `activities` (activity_id)
- Many-to-one with `profiles` (user_id)

---

## Database Functions & Triggers

### `handle_new_user()`

**Type:** Trigger Function  
**Trigger:** `on_auth_user_created` AFTER INSERT on `auth.users`  
**Purpose:** Automatically creates a profile entry when a new user signs up

**Logic:**
- Extracts `username` from `raw_user_meta_data` or generates one (`user_` + first 8 chars of UUID)
- Extracts `full_name` from `raw_user_meta_data` or uses empty string
- Inserts new row into `profiles` table

**Security:** Uses `SECURITY DEFINER` to allow insertion into profiles table

---

## Storage Buckets

### `evidence-images`

**Type:** Public Storage Bucket  
**Purpose:** Stores evidence images/media for activities

**Policies:**
- **Public Read:** Anyone can view images
- **Authenticated Upload:** Only authenticated users can upload
- **User Update/Delete:** Users can only modify their own uploads (based on folder structure)

**Folder Structure:** `{user_id}/{filename}` (enforced by storage policies)

---

## Row Level Security (RLS) Policies

### Profiles

- **SELECT:** Publicly readable (anyone can view profiles)
- **INSERT:** Users can only insert their own profile (trigger handles this)
- **UPDATE:** Users can only update their own profile (`auth.uid() = id`)

### Activities

- **SELECT:** Readable if:
  - `visibility = 'public'` OR
  - `user_id = auth.uid()` (own activities) OR
  - User follows the creator (`user_id IN (SELECT following_id FROM follows WHERE follower_id = auth.uid())`)
- **INSERT:** Users can only insert activities where `user_id = auth.uid()`
- **UPDATE:** Users can only update their own activities (`user_id = auth.uid()`)
- **DELETE:** Users can only delete their own activities (`user_id = auth.uid()`)

### Likes

- **SELECT:** Publicly readable
- **INSERT:** Users can only insert likes where `user_id = auth.uid()`
- **DELETE:** Users can only delete their own likes (`user_id = auth.uid()`)

### Follows

- **SELECT:** Publicly readable
- **INSERT:** Users can only insert follows where `follower_id = auth.uid()`
- **DELETE:** Users can only delete their own follows (`follower_id = auth.uid()`)

### Comments

- **SELECT:** Readable if the associated activity is readable (same logic as activities)
- **INSERT:** Users can only insert comments where `user_id = auth.uid()`
- **UPDATE:** Users can only update their own comments (`user_id = auth.uid()`)
- **DELETE:** Users can only delete their own comments (`user_id = auth.uid()`)

---

## Common Queries

### Get Feed (Following + Own Activities)
```sql
SELECT a.*, p.username, p.full_name, p.avatar_url
FROM activities a
JOIN profiles p ON a.user_id = p.id
WHERE a.visibility = 'public' 
   OR a.user_id = auth.uid()
   OR a.user_id IN (
       SELECT following_id FROM follows WHERE follower_id = auth.uid()
   )
ORDER BY a.created_at DESC
LIMIT 20;
```

### Get Activity with Like/Comment Counts
```sql
SELECT 
  a.*,
  p.username,
  p.full_name,
  p.avatar_url,
  COUNT(DISTINCT l.user_id) as like_count,
  COUNT(DISTINCT c.id) as comment_count,
  EXISTS(SELECT 1 FROM likes WHERE activity_id = a.id AND user_id = auth.uid()) as is_liked
FROM activities a
JOIN profiles p ON a.user_id = p.id
LEFT JOIN likes l ON a.id = l.activity_id
LEFT JOIN comments c ON a.id = c.activity_id
WHERE a.id = $1
GROUP BY a.id, p.id;
```

### Get User Stats
```sql
SELECT 
  COUNT(*) as total_sessions,
  SUM(duration_minutes) as total_minutes,
  SUM(duration_minutes) / 60.0 as total_hours
FROM activities
WHERE user_id = $1;
```

---

## Data Types Reference

- **UUID:** Universally Unique Identifier (128-bit)
- **TEXT:** Variable-length string (unlimited length)
- **INTEGER:** 32-bit signed integer
- **TIMESTAMPTZ:** Timestamp with timezone (stored in UTC)

---

## Migration History

1. **20260101233542_initial_schema.sql** - Initial table creation
2. **20260101233600_handle_new_user_trigger.sql** - User profile auto-creation
3. **20260101233613_rls_policies.sql** - Row Level Security policies
4. **20260101233648_storage_setup.sql** - Storage bucket and policies

---

## Notes

- All timestamps are stored in UTC
- Cascade deletes ensure data integrity (deleting a user removes all their data)
- Composite primary keys prevent duplicate relationships
- Indexes optimize common query patterns
- RLS policies enforce security at the database level

