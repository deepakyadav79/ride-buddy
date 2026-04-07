-- Run this script in your Supabase SQL Editor to enable Advanced Chat Features

-- 1. Add support for Editing and Files to chat_messages table
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS file_type TEXT;

-- 2. Add Row Level Security policies for updating and deleting messages
-- You can only update or delete your own messages
CREATE POLICY "Users can update their own chats" ON public.chat_messages FOR UPDATE USING (auth.uid() = sender_id);
CREATE POLICY "Users can delete their own chats" ON public.chat_messages FOR DELETE USING (auth.uid() = sender_id);

-- 3. Create Storage Bucket for Chat Attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('chat_attachments', 'chat_attachments', true) ON CONFLICT DO NOTHING;

-- 4. Enable Public Access for Chat Attachments
CREATE POLICY "Public Access Attachments" ON storage.objects FOR SELECT USING (bucket_id = 'chat_attachments');
CREATE POLICY "Authenticated users can upload attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete their own attachments" ON storage.objects FOR DELETE USING (bucket_id = 'chat_attachments' AND auth.uid() = owner);
