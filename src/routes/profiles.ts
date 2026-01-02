import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// Validation schema
const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  full_name: z.string().max(100).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  theme_preference: z.enum(['light', 'dark', 'system']).optional(),
});

/**
 * Helper: Calculate streak from activities
 */
function calculateStreak(activities: { created_at: string }[]): number {
  if (activities.length === 0) return 0;

  const dates = [...new Set(
    activities.map(a => new Date(a.created_at).toLocaleDateString())
  )].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  if (dates.length === 0) return 0;

  const today = new Date().toLocaleDateString();
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();

  if (dates[0] !== today && dates[0] !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const currentDate = new Date(dates[i - 1]);
    const prevDate = new Date(dates[i]);
    const diffDays = Math.floor((currentDate.getTime() - prevDate.getTime()) / 86400000);

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * GET /api/profiles/:usernameOrId
 * Get a user profile with stats
 */
router.get('/:usernameOrId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { usernameOrId } = req.params;
    const supabase = req.supabase || supabaseAdmin;
    const currentUserId = req.user?.id;

    // Determine if it's a UUID or username
    const isUuid = usernameOrId.includes('-');

    let query = supabase.from('profiles').select('*');
    if (isUuid) {
      query = query.eq('id', usernameOrId);
    } else {
      query = query.eq('username', usernameOrId);
    }

    const { data: profile, error } = await query.single();

    if (error || !profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    // Get activities for stats
    const { data: activities } = await supabase
      .from('activities')
      .select('duration_minutes, created_at')
      .eq('user_id', profile.id);

    const totalSessions = activities?.length || 0;
    const totalMinutes = activities?.reduce((sum, a) => sum + a.duration_minutes, 0) || 0;
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const currentStreak = calculateStreak(activities || []);

    // Get follower count
    const { count: followerCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profile.id);

    // Get following count
    const { count: followingCount } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profile.id);

    // Check if current user follows this profile
    let isFollowing = false;
    if (currentUserId && currentUserId !== profile.id) {
      const { data: followData } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', profile.id)
        .single();
      isFollowing = !!followData;
    }

    const data = {
      ...profile,
      stats: {
        total_sessions: totalSessions,
        total_hours: totalHours,
        current_streak: currentStreak,
      },
      follower_count: followerCount || 0,
      following_count: followingCount || 0,
      is_following: isFollowing,
    };

    res.json({ data });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * PATCH /api/profiles/me
 * Update current user's profile
 */
router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    // Check if username is taken (if changing)
    if (validation.data.username) {
      const { data: existingUser } = await req.supabase!
        .from('profiles')
        .select('id')
        .eq('username', validation.data.username)
        .neq('id', req.user!.id)
        .single();

      if (existingUser) {
        res.status(409).json({ error: 'Username is already taken' });
        return;
      }
    }

    const { data, error } = await req.supabase!
      .from('profiles')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user!.id)
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ data });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /api/profiles/:userId/follow
 * Follow a user
 */
router.post('/:userId/follow', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (req.user!.id === userId) {
      res.status(400).json({ error: 'Cannot follow yourself' });
      return;
    }

    const { error } = await req.supabase!
      .from('follows')
      .insert({
        follower_id: req.user!.id,
        following_id: userId,
      });

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'Already following this user' });
        return;
      }
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

/**
 * DELETE /api/profiles/:userId/follow
 * Unfollow a user
 */
router.delete('/:userId/follow', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const { error } = await req.supabase!
      .from('follows')
      .delete()
      .eq('follower_id', req.user!.id)
      .eq('following_id', userId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

/**
 * GET /api/profiles/:userId/followers
 * Get followers of a user
 */
router.get('/:userId/followers', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const { data, error } = await supabaseAdmin
      .from('follows')
      .select(`
        follower:profiles!follower_id (*)
      `)
      .eq('following_id', userId)
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const profiles = data?.map(f => f.follower) || [];
    res.json({ data: profiles });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Failed to get followers' });
  }
});

/**
 * GET /api/profiles/:userId/following
 * Get users that a user follows
 */
router.get('/:userId/following', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const { data, error } = await supabaseAdmin
      .from('follows')
      .select(`
        following:profiles!following_id (*)
      `)
      .eq('follower_id', userId)
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const profiles = data?.map(f => f.following) || [];
    res.json({ data: profiles });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Failed to get following' });
  }
});

/**
 * GET /api/profiles/suggested
 * Get suggested users to follow
 */
router.get('/suggested/list', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
    const supabase = req.supabase || supabaseAdmin;
    const userId = req.user?.id;

    if (!userId) {
      // Return random profiles for non-authenticated users
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(limit);

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json({ data });
      return;
    }

    // Get IDs of users already followed
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    const followingIds = followingData?.map(f => f.following_id) || [];
    const excludeIds = [userId, ...followingIds];

    // Get users not in exclude list
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .not('id', 'in', `(${excludeIds.join(',')})`)
      .limit(limit);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ data });
  } catch (error) {
    console.error('Get suggested error:', error);
    res.status(500).json({ error: 'Failed to get suggested users' });
  }
});

/**
 * GET /api/profiles/search
 * Search for users
 */
router.get('/search/query', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    if (!q || q.length < 2) {
      res.status(400).json({ error: 'Search query must be at least 2 characters' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .limit(limit);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ data });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

export default router;

