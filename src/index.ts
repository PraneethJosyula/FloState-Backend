import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import activitiesRoutes from './routes/activities.js';
import profilesRoutes from './routes/profiles.js';
import interactionsRoutes from './routes/interactions.js';
import storageRoutes from './routes/storage.js';

// Import middleware
import { errorHandler } from './middleware/error-handler.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://flo-state-frontend-qslut38dv-praneeth-js-projects.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list or matches Vercel preview pattern
    const isAllowed = allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('flostate') ||
      origin.includes('flo-state');
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow anyway for now, log for debugging
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Status & Info
app.get('/api/status', (req, res) => {
  res.json({
    name: 'FloState API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: {
        'POST /api/auth/signup': 'Create new account',
        'POST /api/auth/signin': 'Sign in with email/password',
        'POST /api/auth/signout': 'Sign out (requires auth)',
        'GET /api/auth/me': 'Get current user (requires auth)',
        'POST /api/auth/refresh': 'Refresh access token',
        'POST /api/auth/reset-password': 'Send password reset email',
      },
      activities: {
        'POST /api/activities': 'Create activity (requires auth)',
        'GET /api/activities/feed': 'Get activity feed',
        'GET /api/activities/user/:userId': 'Get user activities',
        'GET /api/activities/:id': 'Get single activity',
        'PATCH /api/activities/:id': 'Update activity (requires auth)',
        'DELETE /api/activities/:id': 'Delete activity (requires auth)',
      },
      profiles: {
        'GET /api/profiles/:usernameOrId': 'Get user profile',
        'PATCH /api/profiles/me': 'Update own profile (requires auth)',
        'POST /api/profiles/:userId/follow': 'Follow user (requires auth)',
        'DELETE /api/profiles/:userId/follow': 'Unfollow user (requires auth)',
        'GET /api/profiles/:userId/followers': 'Get followers',
        'GET /api/profiles/:userId/following': 'Get following',
        'GET /api/profiles/suggested/list': 'Get suggested users',
        'GET /api/profiles/search/query': 'Search users',
      },
      interactions: {
        'POST /api/interactions/activities/:activityId/like': 'Toggle like (requires auth)',
        'GET /api/interactions/activities/:activityId/likes': 'Get likers',
        'POST /api/interactions/activities/:activityId/comments': 'Add comment (requires auth)',
        'GET /api/interactions/activities/:activityId/comments': 'Get comments',
        'PATCH /api/interactions/comments/:commentId': 'Update comment (requires auth)',
        'DELETE /api/interactions/comments/:commentId': 'Delete comment (requires auth)',
        'POST /api/interactions/activities/:activityId/share': 'Record share',
      },
      storage: {
        'POST /api/storage/evidence': 'Upload evidence image (requires auth)',
        'POST /api/storage/avatar': 'Upload avatar (requires auth)',
        'DELETE /api/storage/evidence/*': 'Delete evidence (requires auth)',
        'GET /api/storage/files': 'List uploaded files (requires auth)',
      },
    },
  });
});

// Root redirect to status
app.get('/', (req, res) => {
  res.redirect('/api/status');
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/interactions', interactionsRoutes);
app.use('/api/storage', storageRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

export default app;

