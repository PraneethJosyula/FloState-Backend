-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    theme_preference TEXT DEFAULT 'system' CHECK (theme_preference IN ('light', 'dark', 'system')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create activities table
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    note TEXT,
    evidence_url TEXT,
    focus_level INTEGER CHECK (focus_level >= 1 AND focus_level <= 10),
    visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    share_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create likes table
CREATE TABLE IF NOT EXISTS public.likes (
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (activity_id, user_id)
);

-- Create follows table
CREATE TABLE IF NOT EXISTS public.follows (
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Create comments table (referenced in plan but not in schema - adding for completeness)
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_activity_id ON public.likes(activity_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_comments_activity_id ON public.comments(activity_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

