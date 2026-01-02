# FocusFlow API Requirements

Complete guide for implementing Supabase service layer functions with database references.

---

## Database Schema Overview

### Tables

| Table | Description | Primary Key |
|-------|-------------|-------------|
| `profiles` | User profiles (auto-created on signup) | `id` (UUID, FK to `auth.users`) |
| `activities` | Focus sessions/posts | `id` (UUID) |
| `likes` | Activity likes | `(activity_id, user_id)` composite |
| `comments` | Activity comments | `id` (UUID) |
| `follows` | User follow relationships | `(follower_id, following_id)` composite |

### Storage Buckets

| Bucket | Description | Access |
|--------|-------------|--------|
| `evidence-images` | Activity evidence photos | Public read, authenticated write |

---

## 1. Authentication APIs

### 1.1 Sign Up

**Function:** `signUpWithEmail(email, password, metadata)`

**Supabase Method:**
```typescript
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      username: metadata?.username,
      full_name: metadata?.full_name
    }
  }
});
```

**Database Effect:**
- Creates row in `auth.users` (Supabase internal)
- Trigger `on_auth_user_created` auto-creates row in `profiles` table

**Profile Auto-Creation (Trigger):**
```sql
-- Username defaults to 'user_' + first 8 chars of UUID if not provided
INSERT INTO profiles (id, username, full_name)
VALUES (NEW.id, COALESCE(metadata.username, 'user_' + id[:8]), metadata.full_name);
```

---

### 1.2 Sign In

**Function:** `signInWithEmail(email, password)`

**Supabase Method:**
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});
```

---

### 1.3 Sign Out

**Function:** `signOut()`

**Supabase Method:**
```typescript
const { error } = await supabase.auth.signOut();
```

---

### 1.4 Get Current User with Profile

**Function:** `getCurrentUser()`

**Supabase Method:**
```typescript
const { data: { user } } = await supabase.auth.getUser();

if (user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return { ...user, profile };
}
```

**Tables Used:** `profiles`

---

## 2. Activity APIs

### 2.1 Create Activity

**Function:** `createActivity(data)`

**Supabase Method:**
```typescript
const { data, error } = await supabase
  .from('activities')
  .insert({
    user_id: currentUserId,  // from auth
    category: data.category,
    duration_minutes: data.duration_minutes,
    note: data.note,
    evidence_url: data.evidence_url,
    focus_level: data.focus_level,
    visibility: data.visibility || 'public'
  })
  .select()
  .single();
```

**Table:** `activities`

**Columns:**
| Column | Type | Required | Constraints |
|--------|------|----------|-------------|
| `user_id` | UUID | Yes | FK → profiles.id |
| `category` | TEXT | Yes | - |
| `duration_minutes` | INTEGER | Yes | - |
| `note` | TEXT | No | - |
| `evidence_url` | TEXT | No | - |
| `focus_level` | INTEGER | No | 1-10 |
| `visibility` | TEXT | No | 'public' or 'private' |

---

### 2.2 Fetch Feed

**Function:** `fetchFeed(options)`

**Supabase Method (Global Feed):**
```typescript
const { data, error } = await supabase
  .from('activities')
  .select(`
    *,
    profile:profiles!user_id (
      username,
      full_name,
      avatar_url
    ),
    likes (user_id),
    comments (id)
  `)
  .eq('visibility', 'public')
  .order('created_at', { ascending: false })
  .range((page - 1) * limit, page * limit - 1);
```

**Supabase Method (Following Feed):**
```typescript
// First get following IDs
const { data: following } = await supabase
  .from('follows')
  .select('following_id')
  .eq('follower_id', currentUserId);

const followingIds = following?.map(f => f.following_id) || [];
followingIds.push(currentUserId); // Include own activities

const { data, error } = await supabase
  .from('activities')
  .select(`
    *,
    profile:profiles!user_id (
      username,
      full_name,
      avatar_url
    ),
    likes (user_id),
    comments (id)
  `)
  .in('user_id', followingIds)
  .order('created_at', { ascending: false })
  .range((page - 1) * limit, page * limit - 1);
```

**Post-Processing:**
```typescript
// Transform response to include counts and is_liked
const activities = data.map(activity => ({
  ...activity,
  like_count: activity.likes?.length || 0,
  comment_count: activity.comments?.length || 0,
  is_liked: activity.likes?.some(like => like.user_id === currentUserId) || false,
  likes: undefined,  // Remove raw likes array
  comments: undefined  // Remove raw comments array
}));
```

**Tables Used:** `activities`, `profiles`, `likes`, `comments`, `follows`

---

### 2.3 Fetch User Activities

**Function:** `fetchUserActivities(userId, options)`

**Supabase Method:**
```typescript
const { data, error } = await supabase
  .from('activities')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(options?.limit || 20)
  .offset(options?.offset || 0);
```

**Table:** `activities`

---

### 2.4 Fetch Activity by ID

**Function:** `fetchActivityById(activityId)`

**Supabase Method:**
```typescript
const { data, error } = await supabase
  .from('activities')
  .select(`
    *,
    profile:profiles!user_id (*),
    likes (user_id),
    comments (
      *,
      profile:profiles!user_id (
        username,
        full_name,
        avatar_url
      )
    )
  `)
  .eq('id', activityId)
  .single();
```

**Post-Processing:**
```typescript
return {
  ...data,
  like_count: data.likes?.length || 0,
  comment_count: data.comments?.length || 0,
  is_liked: data.likes?.some(like => like.user_id === currentUserId) || false,
  comments: data.comments?.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
};
```

**Tables Used:** `activities`, `profiles`, `likes`, `comments`

---

### 2.5 Update Activity

**Function:** `updateActivity(activityId, updates)`

**Supabase Method:**
```typescript
const { data, error } = await supabase
  .from('activities')
  .update({
    category: updates.category,
    note: updates.note,
    evidence_url: updates.evidence_url,
    focus_level: updates.focus_level,
    visibility: updates.visibility
  })
  .eq('id', activityId)
  .eq('user_id', currentUserId)  // RLS ensures only own
  .select()
  .single();
```

**RLS Policy:** Users can only update their own activities

---

### 2.6 Delete Activity

**Function:** `deleteActivity(activityId)`

**Supabase Method:**
```typescript
const { error } = await supabase
  .from('activities')
  .delete()
  .eq('id', activityId)
  .eq('user_id', currentUserId);
```

**Cascade Effect:** Deletes related `likes` and `comments` (FK ON DELETE CASCADE)

---

## 3. Interaction APIs

### 3.1 Toggle Like

**Function:** `toggleLike(activityId)`

**Check if liked:**
```typescript
const { data: existingLike } = await supabase
  .from('likes')
  .select('*')
  .eq('activity_id', activityId)
  .eq('user_id', currentUserId)
  .single();
```

**Like (Insert):**
```typescript
if (!existingLike) {
  const { error } = await supabase
    .from('likes')
    .insert({
      activity_id: activityId,
      user_id: currentUserId
    });
  return { liked: true };
}
```

**Unlike (Delete):**
```typescript
if (existingLike) {
  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('activity_id', activityId)
    .eq('user_id', currentUserId);
  return { liked: false };
}
```

**Table:** `likes`

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| `activity_id` | UUID | FK → activities.id |
| `user_id` | UUID | FK → profiles.id |
| `created_at` | TIMESTAMPTZ | Auto-set |

---

### 3.2 Post Comment

**Function:** `postComment(activityId, text)`

**Supabase Method:**
```typescript
const { data, error } = await supabase
  .from('comments')
  .insert({
    activity_id: activityId,
    user_id: currentUserId,
    text: text
  })
  .select(`
    *,
    profile:profiles!user_id (
      username,
      full_name,
      avatar_url
    )
  `)
  .single();
```

**Table:** `comments`

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `activity_id` | UUID | FK → activities.id |
| `user_id` | UUID | FK → profiles.id |
| `text` | TEXT | Comment content |
| `created_at` | TIMESTAMPTZ | Auto-set |
| `updated_at` | TIMESTAMPTZ | Auto-set |

---

### 3.3 Update Comment

**Function:** `updateComment(commentId, text)`

**Supabase Method:**
```typescript
const { data, error } = await supabase
  .from('comments')
  .update({ 
    text: text,
    updated_at: new Date().toISOString()
  })
  .eq('id', commentId)
  .eq('user_id', currentUserId)
  .select()
  .single();
```

---

### 3.4 Delete Comment

**Function:** `deleteComment(commentId)`

**Supabase Method:**
```typescript
const { error } = await supabase
  .from('comments')
  .delete()
  .eq('id', commentId)
  .eq('user_id', currentUserId);
```

---

### 3.5 Increment Share Count

**Function:** `incrementShareCount(activityId)`

**Supabase Method:**
```typescript
const { error } = await supabase.rpc('increment_share_count', {
  activity_id: activityId
});
```

**Required Database Function:**
```sql
CREATE OR REPLACE FUNCTION increment_share_count(activity_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE activities 
  SET share_count = share_count + 1 
  WHERE id = activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. Profile APIs

### 4.1 Fetch Profile

**Function:** `fetchProfile(usernameOrId)`

**Supabase Method:**
```typescript
// Try by username first, then by ID
let query = supabase
  .from('profiles')
  .select('*');

// Check if it's a UUID
const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (isUUID.test(usernameOrId)) {
  query = query.eq('id', usernameOrId);
} else {
  query = query.eq('username', usernameOrId);
}

const { data: profile } = await query.single();
```

**Get Stats:**
```typescript
// Total sessions & hours
const { data: activities } = await supabase
  .from('activities')
  .select('duration_minutes, created_at')
  .eq('user_id', profile.id);

const totalSessions = activities?.length || 0;
const totalMinutes = activities?.reduce((sum, a) => sum + a.duration_minutes, 0) || 0;
const totalHours = Math.round(totalMinutes / 60);

// Calculate streak (consecutive days with activity)
const currentStreak = calculateStreak(activities);

// Follower/following counts
const { count: followerCount } = await supabase
  .from('follows')
  .select('*', { count: 'exact', head: true })
  .eq('following_id', profile.id);

const { count: followingCount } = await supabase
  .from('follows')
  .select('*', { count: 'exact', head: true })
  .eq('follower_id', profile.id);
```

**Return Structure:**
```typescript
return {
  ...profile,
  stats: {
    total_sessions: totalSessions,
    total_hours: totalHours,
    current_streak: currentStreak
  },
  follower_count: followerCount || 0,
  following_count: followingCount || 0
};
```

**Tables Used:** `profiles`, `activities`, `follows`

---

### 4.2 Update Profile

**Function:** `updateProfile(updates)`

**Supabase Method:**
```typescript
const { data, error } = await supabase
  .from('profiles')
  .update({
    username: updates.username,
    full_name: updates.full_name,
    bio: updates.bio,
    avatar_url: updates.avatar_url,
    theme_preference: updates.theme_preference,
    updated_at: new Date().toISOString()
  })
  .eq('id', currentUserId)
  .select()
  .single();
```

**Table:** `profiles`

**Editable Columns:**
| Column | Type | Constraints |
|--------|------|-------------|
| `username` | TEXT | UNIQUE |
| `full_name` | TEXT | - |
| `bio` | TEXT | - |
| `avatar_url` | TEXT | - |
| `theme_preference` | TEXT | 'light', 'dark', 'system' |

---

### 4.3 Follow User

**Function:** `followUser(userId)`

**Supabase Method:**
```typescript
const { error } = await supabase
  .from('follows')
  .insert({
    follower_id: currentUserId,
    following_id: userId
  });
```

**Table:** `follows`

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| `follower_id` | UUID | User doing the following |
| `following_id` | UUID | User being followed |
| `created_at` | TIMESTAMPTZ | Auto-set |

**Constraint:** `follower_id != following_id` (can't follow yourself)

---

### 4.4 Unfollow User

**Function:** `unfollowUser(userId)`

**Supabase Method:**
```typescript
const { error } = await supabase
  .from('follows')
  .delete()
  .eq('follower_id', currentUserId)
  .eq('following_id', userId);
```

---

### 4.5 Check Follow Status

**Function:** `checkFollowStatus(userId)`

**Supabase Method:**
```typescript
const { data, error } = await supabase
  .from('follows')
  .select('*')
  .eq('follower_id', currentUserId)
  .eq('following_id', userId)
  .single();

return { is_following: !!data };
```

---

### 4.6 Get Suggested Users

**Function:** `getSuggestedUsers(limit)`

**Supabase Method:**
```typescript
// Get users the current user is already following
const { data: following } = await supabase
  .from('follows')
  .select('following_id')
  .eq('follower_id', currentUserId);

const followingIds = following?.map(f => f.following_id) || [];
followingIds.push(currentUserId); // Exclude self

// Get users not in following list
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .not('id', 'in', `(${followingIds.join(',')})`)
  .limit(limit || 5);
```

---

## 5. Storage APIs

### 5.1 Upload Evidence Image

**Function:** `uploadEvidenceImage(file, userId)`

**Supabase Method:**
```typescript
const fileExt = file.name.split('.').pop();
const fileName = `${Date.now()}.${fileExt}`;
const filePath = `${userId}/${fileName}`;

const { data, error } = await supabase.storage
  .from('evidence-images')
  .upload(filePath, file, {
    cacheControl: '3600',
    upsert: false
  });

if (data) {
  const { data: { publicUrl } } = supabase.storage
    .from('evidence-images')
    .getPublicUrl(filePath);
  
  return { url: publicUrl };
}
```

**Bucket:** `evidence-images`

**File Path Format:** `{user_id}/{timestamp}.{extension}`

---

### 5.2 Delete Evidence Image

**Function:** `deleteEvidenceImage(filePath)`

**Supabase Method:**
```typescript
const { error } = await supabase.storage
  .from('evidence-images')
  .remove([filePath]);
```

---

## 6. Required Database Functions

Add these to your migrations:

```sql
-- Function to increment share count
CREATE OR REPLACE FUNCTION increment_share_count(activity_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE activities 
  SET share_count = share_count + 1 
  WHERE id = activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate user stats (optional optimization)
CREATE OR REPLACE FUNCTION get_user_stats(user_id UUID)
RETURNS TABLE (
  total_sessions BIGINT,
  total_hours NUMERIC,
  current_streak INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_sessions,
    ROUND(SUM(duration_minutes) / 60.0, 1) as total_hours,
    -- Streak calculation (simplified)
    (
      SELECT COUNT(DISTINCT DATE(created_at))::INTEGER
      FROM activities a
      WHERE a.user_id = $1
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    ) as current_streak
  FROM activities
  WHERE activities.user_id = $1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 7. RLS Policies Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | Public | Own only | Own only | - |
| `activities` | Public/Following/Own | Own only | Own only | Own only |
| `likes` | Public | Own only | - | Own only |
| `comments` | Same as parent activity | Own only | Own only | Own only |
| `follows` | Public | Own only | - | Own only |

---

## 8. Environment Variables

```env
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

---

## 9. Supabase Client Setup

**File:** `frontend/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**File:** `frontend/lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}
```

---

## 10. Implementation Checklist

### Database Setup
- [ ] Run migration 001 (schema)
- [ ] Run migration 002 (user trigger)
- [ ] Run migration 003 (RLS policies)
- [ ] Run migration 004 (storage)
- [ ] Add `increment_share_count` function

### Service Implementation
- [ ] `lib/supabase/client.ts` - Browser client
- [ ] `lib/supabase/server.ts` - Server client
- [ ] `lib/services/auth.ts` - Auth functions
- [ ] `lib/services/activities.ts` - Activity CRUD
- [ ] `lib/services/interactions.ts` - Likes, comments, shares
- [ ] `lib/services/profiles.ts` - Profile management
- [ ] `lib/services/storage.ts` - Image uploads

### Testing
- [ ] Test signup → profile auto-creation
- [ ] Test activity CRUD with RLS
- [ ] Test like/unlike toggle
- [ ] Test comment CRUD
- [ ] Test follow/unfollow
- [ ] Test image upload/delete
- [ ] Test feed filtering (global vs following)

