import { Request, Response, NextFunction } from 'express';
import { verifyToken, createUserClient } from '../lib/supabase.js';
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
      supabase?: SupabaseClient<Database>;
      accessToken?: string;
    }
  }
}

/**
 * Authentication middleware - requires valid JWT token
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }
    
    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    
    // Attach user and supabase client to request
    req.user = user;
    req.accessToken = token;
    req.supabase = createUserClient(token);
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Optional authentication - attaches user if token provided
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await verifyToken(token);
      
      if (user) {
        req.user = user;
        req.accessToken = token;
        req.supabase = createUserClient(token);
      }
    }
    
    next();
  } catch (error) {
    // Continue without auth on error
    next();
  }
}

