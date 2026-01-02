import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const signUpSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  full_name: z.string().optional(),
});

const signInSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/auth/signup
 * Create a new user account
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const validation = signUpSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const { email, password, username, full_name } = validation.data;

    // Check if username is taken
    if (username) {
      const { data: existingUser } = await supabaseAdmin
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (existingUser) {
        res.status(409).json({ error: 'Username is already taken' });
        return;
      }
    }

    // Create user in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for now
      user_metadata: {
        username,
        full_name,
      },
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    // Generate session for the new user
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    // Sign in the user to get tokens
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      res.status(400).json({ error: signInError.message });
      return;
    }

    res.status(201).json({
      user: data.user,
      session: signInData.session,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

/**
 * POST /api/auth/signin
 * Sign in with email and password
 */
router.post('/signin', async (req: Request, res: Response) => {
  try {
    const validation = signInSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.errors[0].message });
      return;
    }

    const { email, password } = validation.data;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    res.json({
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Failed to sign in' });
  }
});

/**
 * POST /api/auth/signout
 * Sign out the current user
 */
router.post('/signout', requireAuth, async (req: Request, res: Response) => {
  try {
    // Invalidate the session on the server side
    // Note: With JWT, we can't truly invalidate, but we clear on client
    res.json({ success: true });
  } catch (error) {
    console.error('Signout error:', error);
    res.status(500).json({ error: 'Failed to sign out' });
  }
});

/**
 * GET /api/auth/me
 * Get current user with profile
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    
    // Fetch profile
    const { data: profile } = await req.supabase!
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    res.json({
      id: user.id,
      email: user.email,
      profile,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    res.json({
      session: data.session,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

/**
 * POST /api/auth/reset-password
 * Send password reset email
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

export default router;

