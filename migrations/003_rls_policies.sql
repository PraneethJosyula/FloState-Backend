-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
-- Read: Publicly readable
CREATE POLICY "Profiles are publicly readable"
    ON public.profiles
    FOR SELECT
    USING (true);

-- Write: Users can only update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Insert: Users can insert their own profile (though trigger handles this)
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Activities Policies
-- Read: Public activities OR activities from users you follow OR your own activities
CREATE POLICY "Activities are readable if public or from followed users or own"
    ON public.activities
    FOR SELECT
    USING (
        visibility = 'public' OR
        user_id = auth.uid() OR
        user_id IN (
            SELECT following_id 
            FROM public.follows 
            WHERE follower_id = auth.uid()
        )
    );

-- Write: Users can only insert/update their own activities
CREATE POLICY "Users can insert own activities"
    ON public.activities
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities"
    ON public.activities
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities"
    ON public.activities
    FOR DELETE
    USING (auth.uid() = user_id);

-- Likes Policies
-- Read: Publicly readable
CREATE POLICY "Likes are publicly readable"
    ON public.likes
    FOR SELECT
    USING (true);

-- Write: Users can only like/unlike (insert/delete their own likes)
CREATE POLICY "Users can insert own likes"
    ON public.likes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
    ON public.likes
    FOR DELETE
    USING (auth.uid() = user_id);

-- Follows Policies
-- Read: Publicly readable
CREATE POLICY "Follows are publicly readable"
    ON public.follows
    FOR SELECT
    USING (true);

-- Write: Users can only follow/unfollow (insert/delete their own follows)
CREATE POLICY "Users can insert own follows"
    ON public.follows
    FOR INSERT
    WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete own follows"
    ON public.follows
    FOR DELETE
    USING (auth.uid() = follower_id);

-- Comments Policies
-- Read: Publicly readable (same visibility as activities)
CREATE POLICY "Comments are readable if activity is readable"
    ON public.comments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.activities
            WHERE activities.id = comments.activity_id
            AND (
                activities.visibility = 'public' OR
                activities.user_id = auth.uid() OR
                activities.user_id IN (
                    SELECT following_id 
                    FROM public.follows 
                    WHERE follower_id = auth.uid()
                )
            )
        )
    );

-- Write: Users can insert/update/delete their own comments
CREATE POLICY "Users can insert own comments"
    ON public.comments
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
    ON public.comments
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
    ON public.comments
    FOR DELETE
    USING (auth.uid() = user_id);

