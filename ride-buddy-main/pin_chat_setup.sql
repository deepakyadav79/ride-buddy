-- Run this script in your Supabase SQL Editor to enable Chat and PIN Verification features

-- 1. Add verification_pin to ride_requests
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS verification_pin TEXT;
ALTER TABLE public.ride_requests ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- 2. Create messages table for chatting between users
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_request_id UUID NOT NULL REFERENCES public.ride_requests(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow users involved in the ride to select/insert messages
CREATE POLICY "Users can view chats for their rides" 
ON public.chat_messages FOR SELECT 
USING (
  sender_id = auth.uid() OR 
  auth.uid() IN (
    SELECT passenger_id FROM public.ride_requests WHERE id = public.chat_messages.ride_request_id
    UNION
    SELECT driver_id FROM public.rides WHERE id = (SELECT ride_id FROM public.ride_requests WHERE id = public.chat_messages.ride_request_id)
  )
);

CREATE POLICY "Users can insert chats for their rides" 
ON public.chat_messages FOR INSERT 
WITH CHECK (
  sender_id = auth.uid()
);
