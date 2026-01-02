import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

const EVIDENCE_BUCKET = 'evidence-images';

/**
 * POST /api/storage/evidence
 * Upload an evidence image
 */
router.post(
  '/evidence',
  requireAuth,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const userId = req.user!.id;
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabaseAdmin.storage
        .from(EVIDENCE_BUCKET)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from(EVIDENCE_BUCKET)
        .getPublicUrl(data.path);

      res.status(201).json({
        url: urlData.publicUrl,
        path: data.path,
      });
    } catch (error) {
      console.error('Upload evidence error:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  }
);

/**
 * POST /api/storage/avatar
 * Upload a user avatar
 */
router.post(
  '/avatar',
  requireAuth,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      // Stricter validation for avatars
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        res.status(400).json({ error: 'Invalid file type for avatar' });
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        res.status(400).json({ error: 'Avatar must be less than 2MB' });
        return;
      }

      const userId = req.user!.id;
      const fileExt = file.originalname.split('.').pop();
      const filePath = `avatars/${userId}.${fileExt}`;

      // Upload with upsert to replace existing avatar
      const { data, error } = await supabaseAdmin.storage
        .from(EVIDENCE_BUCKET)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      // Get public URL with cache buster
      const { data: urlData } = supabaseAdmin.storage
        .from(EVIDENCE_BUCKET)
        .getPublicUrl(data.path);

      const url = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL
      await req.supabase!
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', userId);

      res.status(201).json({ url });
    } catch (error) {
      console.error('Upload avatar error:', error);
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  }
);

/**
 * DELETE /api/storage/evidence/:path
 * Delete an evidence image
 */
router.delete('/evidence/*', requireAuth, async (req: Request, res: Response) => {
  try {
    const filePath = req.params[0];
    const userId = req.user!.id;

    // Verify the file belongs to the user
    if (!filePath.startsWith(userId)) {
      res.status(403).json({ error: 'Not authorized to delete this file' });
      return;
    }

    const { error } = await supabaseAdmin.storage
      .from(EVIDENCE_BUCKET)
      .remove([filePath]);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete evidence error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

/**
 * GET /api/storage/files
 * List user's uploaded files
 */
router.get('/files', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const { data, error } = await supabaseAdmin.storage
      .from(EVIDENCE_BUCKET)
      .list(userId, {
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const files = (data || []).map(file => ({
      name: file.name,
      size: file.metadata?.size || 0,
      created_at: file.created_at || '',
      url: supabaseAdmin.storage
        .from(EVIDENCE_BUCKET)
        .getPublicUrl(`${userId}/${file.name}`).data.publicUrl,
    }));

    res.json({ data: files });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

export default router;

