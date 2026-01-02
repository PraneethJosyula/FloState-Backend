import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// Validation schema
const commentSchema = z.object({
  text: z.string().min(1, 'Comment cannot be empty').max(1000, 'Comment too long'),
});

/**
 * POST /api/interactions/activities/:activityId/like
 * Toggle like on an activity
 */
router.post('/activities/:activityId/like', requireAuth, async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const userId = req.user!.id;

    // Check if already liked
    const { data: existingLike } = await req.supabase!
      .from('likes')
      .select('activity_id')
      .eq('activity_id', activityId)
      .eq('user_id', userId)
      .single();

    if (existingLike) {
      // Unlike
      const { error } = await req.supabase!
        .from('likes')
        .delete()
        .eq('activity_id', activityId)
        .eq('user_id', userId);

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json({ liked: false });
    } else {
      // Like
      const { error } = await req.supabase!
        .from('likes')
        .insert({
          activity_id: activityId,
          user_id: userId,
        });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.json({ liked: true });
    }
  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

/**
 * GET /api/interactions/activities/:activityId/likes
 * Get users who liked an activity
 */
router.get('/activities/:activityId/likes', async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const { data, error } = await supabaseAdmin
      .from('likes')
      .select(`
        profile:profiles!user_id (
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const likers = data?.map(l => l.profile) || [];
    res.json({ data: likers });
  } catch (error) {
    console.error('Get likers error:', error);
    res.status(500).json({ error: 'Failed to get likers' });
  }
});

/**
 * POST /api/interactions/activities/:activityId/comments
 * Post a comment on an activity
 */
router.post('/activities/:activityId/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    
    const validation = commentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const { data, error } = await req.supabase!
      .from('comments')
      .insert({
        activity_id: activityId,
        user_id: req.user!.id,
        text: validation.data.text,
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

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ data });
  } catch (error) {
    console.error('Post comment error:', error);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

/**
 * GET /api/interactions/activities/:activityId/comments
 * Get comments for an activity
 */
router.get('/activities/:activityId/comments', async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const { data, error } = await supabaseAdmin
      .from('comments')
      .select(`
        *,
        profile:profiles!user_id (
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ data });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

/**
 * PATCH /api/interactions/comments/:commentId
 * Update a comment
 */
router.patch('/comments/:commentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    
    const validation = commentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const { data, error } = await req.supabase!
      .from('comments')
      .update({
        text: validation.data.text,
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .eq('user_id', req.user!.id) // Ensure ownership
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Comment not found or not authorized' });
      return;
    }

    res.json({ data });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

/**
 * DELETE /api/interactions/comments/:commentId
 * Delete a comment
 */
router.delete('/comments/:commentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;

    const { error } = await req.supabase!
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', req.user!.id); // Ensure ownership

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

/**
 * POST /api/interactions/activities/:activityId/share
 * Increment share count for an activity
 */
router.post('/activities/:activityId/share', async (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;

    // Get current share count
    const { data: activity } = await supabaseAdmin
      .from('activities')
      .select('share_count')
      .eq('id', activityId)
      .single();

    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    // Increment
    const { error } = await supabaseAdmin
      .from('activities')
      .update({ share_count: (activity.share_count || 0) + 1 })
      .eq('id', activityId);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ success: true, share_count: (activity.share_count || 0) + 1 });
  } catch (error) {
    console.error('Share error:', error);
    res.status(500).json({ error: 'Failed to record share' });
  }
});

export default router;

