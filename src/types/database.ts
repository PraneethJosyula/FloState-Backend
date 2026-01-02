/**
 * Database Types for FocusFlow
 * Compatible with @supabase/supabase-js v2
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

// Extended types with joins
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

// Simplified Database type that works with Supabase client
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; username: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      activities: {
        Row: Activity;
        Insert: Partial<Activity> & { user_id: string; category: string; duration_minutes: number };
        Update: Partial<Activity>;
        Relationships: [];
      };
      likes: {
        Row: Like;
        Insert: { activity_id: string; user_id: string };
        Update: Partial<Like>;
        Relationships: [];
      };
      comments: {
        Row: Comment;
        Insert: Partial<Comment> & { activity_id: string; user_id: string; text: string };
        Update: Partial<Comment>;
        Relationships: [];
      };
      follows: {
        Row: Follow;
        Insert: { follower_id: string; following_id: string };
        Update: Partial<Follow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Helper type for query results
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

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
