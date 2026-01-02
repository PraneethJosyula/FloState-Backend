-- Create storage bucket for evidence images
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence-images', 'evidence-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for evidence images bucket
-- Allow public read access
CREATE POLICY "Public can view evidence images"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'evidence-images');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload evidence images"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'evidence-images' AND
        auth.role() = 'authenticated'
    );

-- Allow users to update their own uploads
CREATE POLICY "Users can update own evidence images"
    ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'evidence-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own evidence images"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'evidence-images' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

