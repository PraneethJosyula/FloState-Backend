/**
 * Database Types for FocusFlow
 */

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

// Extended types
export interface ActivityWithProfile extends Activity {
  profile: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  like_count: number;
  comment_count: number;
  is_liked: boolean;
}

export interface CommentWithProfile extends Comment {
  profile: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface ProfileWithStats extends Profile {
  stats: {
    total_sessions: number;
    total_hours: number;
    current_streak: number;
  };
  follower_count: number;
  following_count: number;
  is_following?: boolean;
}

// Database schema type for Supabase client
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id'>>;
      };
      activities: {
        Row: Activity;
        Insert: Omit<Activity, 'id' | 'created_at' | 'share_count'>;
        Update: Partial<Omit<Activity, 'id' | 'user_id'>>;
      };
      likes: {
        Row: Like;
        Insert: Omit<Like, 'created_at'>;
        Update: never;
      };
      comments: {
        Row: Comment;
        Insert: Omit<Comment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Pick<Comment, 'text'>>;
      };
      follows: {
        Row: Follow;
        Insert: Omit<Follow, 'created_at'>;
        Update: never;
      };
    };
  };
}

// Request types
export interface CreateActivityInput {
  category: string;
  duration_minutes: number;
  note?: string;
  evidence_url?: string;
  focus_level?: number;
  visibility?: 'public' | 'private';
}

export interface UpdateActivityInput {
  category?: string;
  duration_minutes?: number;
  note?: string;
  evidence_url?: string;
  focus_level?: number;
  visibility?: 'public' | 'private';
}

export interface UpdateProfileInput {
  username?: string;
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  theme_preference?: 'light' | 'dark' | 'system';
}

export interface FeedOptions {
  page?: number;
  limit?: number;
  filter?: 'following' | 'global';
}

