import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// Validation schemas
const createActivitySchema = z.object({
  category: z.string().min(1, 'Category is required'),
  duration_minutes: z.number().min(1, 'Duration must be at least 1 minute'),
  note: z.string().optional(),
  evidence_url: z.string().url().optional().nullable(),
  focus_level: z.number().min(1).max(10).optional().nullable(),
  visibility: z.enum(['public', 'private']).default('public'),
});

const updateActivitySchema = createActivitySchema.partial();

/**
 * POST /api/activities
 * Create a new activity
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const validation = createActivitySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const { data, error } = await req.supabase!
      .from('activities')
      .insert({
        user_id: req.user!.id,
        ...validation.data,
      })
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ data });
  } catch (error) {
    console.error('Create activity error:', error);
    res.status(500).json({ error: 'Failed to create activity' });
  }
});

/**
 * GET /api/activities/feed
 * Get activity feed
 */
router.get('/feed', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const filter = (req.query.filter as string) || 'global';
    const offset = (page - 1) * limit;

    const supabase = req.supabase || supabaseAdmin;
    const userId = req.user?.id;

    // Build query
    let query = supabase
      .from('activities')
      .select(`
        *,
        profile:profiles!user_id (
          username,
          full_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filter
    if (filter === 'following' && userId) {
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      const followingIds = followingData?.map(f => f.following_id) || [];
      const filterIds = [userId, ...followingIds];
      
      query = query.in('user_id', filterIds);
    } else {
      query = query.eq('visibility', 'public');
    }

    const { data: activities, error } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (!activities || activities.length === 0) {
      res.json({ data: [] });
      return;
    }

    // Get like and comment counts
    const activityIds = activities.map(a => a.id);

    const { data: likeCounts } = await supabase
      .from('likes')
      .select('activity_id')
      .in('activity_id', activityIds);

    const { data: commentCounts } = await supabase
      .from('comments')
      .select('activity_id')
      .in('activity_id', activityIds);

    // Get user's likes
    let userLikes: string[] = [];
    if (userId) {
      const { data: userLikesData } = await supabase
        .from('likes')
        .select('activity_id')
        .eq('user_id', userId)
        .in('activity_id', activityIds);
      userLikes = userLikesData?.map(l => l.activity_id) || [];
    }

    // Aggregate counts
    const likeCountMap = new Map<string, number>();
    const commentCountMap = new Map<string, number>();

    likeCounts?.forEach(l => {
      likeCountMap.set(l.activity_id, (likeCountMap.get(l.activity_id) || 0) + 1);
    });

    commentCounts?.forEach(c => {
      commentCountMap.set(c.activity_id, (commentCountMap.get(c.activity_id) || 0) + 1);
    });

    // Transform response
    const data = activities.map((activity: any) => ({
      ...activity,
      profile: activity.profile,
      like_count: likeCountMap.get(activity.id) || 0,
      comment_count: commentCountMap.get(activity.id) || 0,
      is_liked: userLikes.includes(activity.id),
    }));

    res.json({ data });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Failed to get feed' });
  }
});

/**
 * GET /api/activities/user/:userId
 * Get activities for a specific user
 */
router.get('/user/:userId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const supabase = req.supabase || supabaseAdmin;

    // Check if userId is a username
    let actualUserId = userId;
    if (!userId.includes('-')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', userId)
        .single();

      if (profile) {
        actualUserId = profile.id;
      }
    }

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', actualUserId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ data });
  } catch (error) {
    console.error('Get user activities error:', error);
    res.status(500).json({ error: 'Failed to get activities' });
  }
});

/**
 * GET /api/activities/:id
 * Get a single activity with details
 */
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supabase = req.supabase || supabaseAdmin;
    const userId = req.user?.id;

    // Fetch activity with profile
    const { data: activity, error } = await supabase
      .from('activities')
      .select(`
        *,
        profile:profiles!user_id (*)
      `)
      .eq('id', id)
      .single();

    if (error || !activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    // Fetch comments
    const { data: comments } = await supabase
      .from('comments')
      .select(`
        *,
        profile:profiles!user_id (
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('activity_id', id)
      .order('created_at', { ascending: true });

    // Get like count
    const { count: likeCount } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('activity_id', id);

    // Check if user liked
    let isLiked = false;
    if (userId) {
      const { data: userLike } = await supabase
        .from('likes')
        .select('activity_id')
        .eq('activity_id', id)
        .eq('user_id', userId)
        .single();
      isLiked = !!userLike;
    }

    res.json({
      data: {
        ...activity,
        like_count: likeCount || 0,
        comment_count: comments?.length || 0,
        is_liked: isLiked,
        comments: comments || [],
      },
    });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

/**
 * PATCH /api/activities/:id
 * Update an activity
 */
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const validation = updateActivitySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const { data, error } = await req.supabase!
      .from('activities')
      .update(validation.data)
      .eq('id', id)
      .eq('user_id', req.user!.id) // Ensure ownership
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Activity not found or not authorized' });
      return;
    }

    res.json({ data });
  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

/**
 * DELETE /api/activities/:id
 * Delete an activity
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await req.supabase!
      .from('activities')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user!.id); // Ensure ownership

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

export default router;

