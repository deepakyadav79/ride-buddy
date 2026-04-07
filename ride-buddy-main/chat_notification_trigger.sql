-- Create a trigger function to notify users when a new chat message is sent
CREATE OR REPLACE FUNCTION public.notify_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
    v_receiver_id UUID;
    v_passenger_id UUID;
    v_driver_id UUID;
    v_sender_name TEXT;
BEGIN
    -- Get passenger and driver info for this ride request
    SELECT rr.passenger_id, r.driver_id INTO v_passenger_id, v_driver_id
    FROM public.ride_requests rr
    LEFT JOIN public.rides r ON rr.ride_id = r.id
    WHERE rr.id = NEW.ride_request_id;
    
    -- Determine the receiver of the message (the person who didn't send it)
    IF NEW.sender_id = v_passenger_id THEN
        v_receiver_id := v_driver_id;
    ELSE
        v_receiver_id := v_passenger_id;
    END IF;

    -- Get sender's name
    SELECT full_name INTO v_sender_name 
    FROM public.profiles 
    WHERE user_id = NEW.sender_id;
    
    IF v_sender_name IS NULL THEN
        v_sender_name := 'User';
    END IF;

    -- Insert a record into the notifications table if a receiver is found
    IF v_receiver_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type)
        VALUES (
            v_receiver_id, 
            'New message from ' || v_sender_name, 
            NEW.message, 
            'chat'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the chat_messages table
DROP TRIGGER IF EXISTS on_chat_message_inserted ON public.chat_messages;
CREATE TRIGGER on_chat_message_inserted
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_chat_message();
