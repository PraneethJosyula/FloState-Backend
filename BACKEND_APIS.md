# FocusFlow Backend APIs Documentation

## Architecture Overview

FocusFlow uses **Supabase** as a Backend-as-a-Service (BaaS) with **Next.js Server Actions** for server-side logic. The application follows a direct database access pattern secured by Row Level Security (RLS), eliminating the need for traditional REST API middleware.

**Key Principles:**
- Frontend calls Supabase directly using the Supabase Client
- Security enforced via RLS policies at the database level
- Server Actions handle server-side operations (OpenGraph, sitemaps)
- Storage handled via Supabase Storage API

---

## Service Layer Functions

These functions should be implemented in `/frontend/lib/services/` to keep components clean and reusable.

---

## 1. Authentication Service

**File:** `lib/services/auth.ts`

### `signInWithEmail(email: string, password: string)`

Signs in a user with email and password.

**Parameters:**
- `email` (string): User's email address
- `password` (string): User's password

**Returns:** `Promise<{ user: User | null, error: AuthError | null }>`

**Example:**
```typescript
const { user, error } = await signInWithEmail('user@example.com', 'password123');
if (error) {
  console.error('Sign in failed:', error.message);
} else {
  // Redirect to /feed
}
```

---

### `signUpWithEmail(email: string, password: string, metadata?: { username?: string, full_name?: string })`

Creates a new user account.

**Parameters:**
- `email` (string): User's email address
- `password` (string): User's password (min 6 characters)
- `metadata` (optional): Additional user metadata
  - `username` (optional): Desired username
  - `full_name` (optional): User's full name

**Returns:** `Promise<{ user: User | null, error: AuthError | null }>`

**Example:**
```typescript
const { user, error } = await signUpWithEmail(
  'user@example.com',
  'password123',
  { username: 'johndoe', full_name: 'John Doe' }
);
```

**Note:** Profile is automatically created via database trigger.

---

### `signOut()`

Signs out the current user.

**Returns:** `Promise<{ error: AuthError | null }>`

**Example:**
```typescript
const { error } = await signOut();
if (!error) {
  // Redirect to home page
}
```

---

### `getSession()`

Gets the current user session.

**Returns:** `Promise<Session | null>`

**Example:**
```typescript
const session = await getSession();
if (session) {
  console.log('User ID:', session.user.id);
}
```

---

### `getCurrentUser()`

Gets the current authenticated user with profile data.

**Returns:** `Promise<{ id: string, email: string, profile: Profile | null } | null>`

**Example:**
```typescript
const user = await getCurrentUser();
if (user?.profile) {
  console.log('Username:', user.profile.username);
}
```

---

## 2. Activity Service

**File:** `lib/services/activities.ts`

### `createActivity(data: CreateActivityInput)`

Creates a new activity/post.

**Parameters:**
```typescript
interface CreateActivityInput {
  category: string;
  duration_minutes: number;
  note?: string;
  evidence_url?: string;
  focus_level?: number; // 1-10
  visibility?: 'public' | 'private'; // defaults to 'public'
}
```

**Returns:** `Promise<{ data: Activity | null, error: PostgrestError | null }>`

**Example:**
```typescript
const { data, error } = await createActivity({
  category: 'Deep Work',
  duration_minutes: 120,
  note: 'Finished the authentication system',
  focus_level: 9,
  visibility: 'public'
});
```

---

### `fetchFeed(options?: FeedOptions)`

Fetches activities for the feed (following + own + public).

**Parameters:**
```typescript
interface FeedOptions {
  page?: number; // Default: 1
  limit?: number; // Default: 20
  filter?: 'following' | 'global'; // Default: 'following'
}
```

**Returns:** `Promise<{ data: ActivityWithProfile[] | null, error: PostgrestError | null }>`

**Example:**
```typescript
const { data, error } = await fetchFeed({ 
  page: 1, 
  limit: 20, 
  filter: 'following' 
});
```

**Response Structure:**
```typescript
interface ActivityWithProfile extends Activity {
  profile: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  like_count: number;
  comment_count: number;
  is_liked: boolean;
}
```

---

### `fetchUserActivities(userId: string, options?: { limit?: number, offset?: number })`

Fetches activities for a specific user (for profile page).

**Parameters:**
- `userId` (string): User ID or username
- `options` (optional): Pagination options

**Returns:** `Promise<{ data: Activity[] | null, error: PostgrestError | null }>`

**Example:**
```typescript
const { data } = await fetchUserActivities('user-uuid-here', { limit: 10 });
```

---

### `fetchActivityById(activityId: string)`

Fetches a single activity with full details (for activity detail page).

**Parameters:**
- `activityId` (string): Activity UUID

**Returns:** `Promise<{ data: ActivityDetail | null, error: PostgrestError | null }>`

**Response Structure:**
```typescript
interface ActivityDetail extends Activity {
  profile: Profile;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  comments: CommentWithProfile[];
}
```

---

### `updateActivity(activityId: string, updates: Partial<CreateActivityInput>)`

Updates an existing activity (only own activities).

**Parameters:**
- `activityId` (string): Activity UUID
- `updates` (Partial<CreateActivityInput>): Fields to update

**Returns:** `Promise<{ data: Activity | null, error: PostgrestError | null }>`

---

### `deleteActivity(activityId: string)`

Deletes an activity (only own activities).

**Parameters:**
- `activityId` (string): Activity UUID

**Returns:** `Promise<{ error: PostgrestError | null }>`

---

## 3. Interaction Service

**File:** `lib/services/interactions.ts`

### `toggleLike(activityId: string)`

Toggles like on an activity (like if not liked, unlike if liked).

**Parameters:**
- `activityId` (string): Activity UUID

**Returns:** `Promise<{ liked: boolean, error: PostgrestError | null }>`

**Example:**
```typescript
const { liked, error } = await toggleLike('activity-uuid');
// Optimistic UI update recommended
```

---

### `postComment(activityId: string, text: string)`

Posts a comment on an activity.

**Parameters:**
- `activityId` (string): Activity UUID
- `text` (string): Comment text

**Returns:** `Promise<{ data: Comment | null, error: PostgrestError | null }>`

**Example:**
```typescript
const { data, error } = await postComment('activity-uuid', 'Great work!');
```

---

### `updateComment(commentId: string, text: string)`

Updates a comment (only own comments).

**Parameters:**
- `commentId` (string): Comment UUID
- `text` (string): Updated comment text

**Returns:** `Promise<{ data: Comment | null, error: PostgrestError | null }>`

---

### `deleteComment(commentId: string)`

Deletes a comment (only own comments).

**Parameters:**
- `commentId` (string): Comment UUID

**Returns:** `Promise<{ error: PostgrestError | null }>`

---

### `incrementShareCount(activityId: string)`

Increments the share count for an activity (called when user shares).

**Parameters:**
- `activityId` (string): Activity UUID

**Returns:** `Promise<{ error: PostgrestError | null }>`

**Example:**
```typescript
await incrementShareCount('activity-uuid');
// Then open share modal or copy link
```

---

## 4. Profile Service

**File:** `lib/services/profiles.ts`

### `fetchProfile(usernameOrId: string)`

Fetches a user profile by username or ID.

**Parameters:**
- `usernameOrId` (string): Username or user UUID

**Returns:** `Promise<{ data: ProfileWithStats | null, error: PostgrestError | null }>`

**Response Structure:**
```typescript
interface ProfileWithStats extends Profile {
  stats: {
    total_sessions: number;
    total_hours: number;
    current_streak: number; // Days
  };
  follower_count: number;
  following_count: number;
}
```

---

### `updateProfile(updates: Partial<Profile>)`

Updates the current user's profile.

**Parameters:**
```typescript
interface ProfileUpdate {
  username?: string;
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  theme_preference?: 'light' | 'dark' | 'system';
}
```

**Returns:** `Promise<{ data: Profile | null, error: PostgrestError | null }>`

**Example:**
```typescript
const { data } = await updateProfile({
  bio: 'Productivity enthusiast',
  theme_preference: 'dark'
});
```

---

### `followUser(userId: string)`

Follows a user.

**Parameters:**
- `userId` (string): User UUID to follow

**Returns:** `Promise<{ error: PostgrestError | null }>`

---

### `unfollowUser(userId: string)`

Unfollows a user.

**Parameters:**
- `userId` (string): User UUID to unfollow

**Returns:** `Promise<{ error: PostgrestError | null }>`

---

### `checkFollowStatus(userId: string)`

Checks if current user follows a specific user.

**Parameters:**
- `userId` (string): User UUID

**Returns:** `Promise<{ is_following: boolean, error: PostgrestError | null }>`

---

### `getSuggestedUsers(limit?: number)`

Gets suggested users to follow (users not already followed).

**Parameters:**
- `limit` (number, optional): Number of suggestions (default: 5)

**Returns:** `Promise<{ data: Profile[] | null, error: PostgrestError | null }>`

---

## 5. Storage Service

**File:** `lib/services/storage.ts`

### `uploadEvidenceImage(file: File, userId: string)`

Uploads an evidence image to Supabase Storage.

**Parameters:**
- `file` (File): Image file to upload
- `userId` (string): Current user ID

**Returns:** `Promise<{ url: string | null, error: StorageError | null }>`

**Process:**
1. Compress/resize image (optional, recommended)
2. Upload to `evidence-images/{userId}/{filename}`
3. Return public URL

**Example:**
```typescript
const { url, error } = await uploadEvidenceImage(file, user.id);
if (url) {
  // Use url in createActivity
}
```

---

### `deleteEvidenceImage(filePath: string)`

Deletes an evidence image from storage.

**Parameters:**
- `filePath` (string): Path to file in storage

**Returns:** `Promise<{ error: StorageError | null }>`

---

## 6. Server Actions (Next.js)

**File:** `app/actions/` (Server Actions)

### `generateOpenGraphImage(activityId: string)`

**Route:** `/api/og/[activityId]`  
**Method:** GET  
**Purpose:** Generates OpenGraph image for activity sharing

**Implementation:** Uses `@vercel/og` to create dynamic image

**Example URL:** `/api/og/abc123-def456-ghi789`

**Response:** Image (PNG/JPEG)

---

### `generateSitemap()`

**Route:** `/sitemap.xml`  
**Method:** GET  
**Purpose:** Generates sitemap for SEO

**Returns:** XML sitemap with public user profiles and activities

---

## Error Handling

All service functions should handle errors consistently:

```typescript
try {
  const { data, error } = await someServiceFunction();
  if (error) {
    // Handle Supabase error
    console.error('Service error:', error.message);
    return { data: null, error };
  }
  return { data, error: null };
} catch (err) {
  // Handle unexpected errors
  console.error('Unexpected error:', err);
  return { data: null, error: err };
}
```

---

## Type Definitions

**File:** `lib/types/database.ts`

```typescript
export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  theme_preference: 'light' | 'dark' | 'system';
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  category: string;
  duration_minutes: number;
  note: string | null;
  evidence_url: string | null;
  focus_level: number | null;
  visibility: 'public' | 'private';
  share_count: number;
  created_at: string;
}

export interface Like {
  activity_id: string;
  user_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  activity_id: string;
  user_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}
```

---

## Implementation Notes

1. **Optimistic UI Updates:** Use for likes/comments to improve UX
2. **Error Boundaries:** Wrap service calls in error boundaries
3. **Loading States:** Use React Suspense or loading states
4. **Caching:** Consider React Query or SWR for data fetching
5. **Real-time:** Use Supabase Realtime for live updates (optional)

---

## Testing

Each service function should be tested with:
- Success cases
- Error cases (network, validation, RLS violations)
- Edge cases (empty results, null values)
