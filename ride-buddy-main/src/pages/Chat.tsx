import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

export default function Chat() {
  const { requestId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!requestId || !user) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("ride_request_id", requestId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    };
    
    const markUnreadAsRead = async () => {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('type', 'chat')
        .eq('is_read', false);
    };

    fetchMessages();
    markUnreadAsRead();

    const channel = supabase
      .channel("chat_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `ride_request_id=eq.${requestId}` },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          setMessages((current) => {
            if (current.some(m => m.id === incoming.id)) return current;
            return [...current, incoming];
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !requestId) return;

    const msg = newMessage.trim();
    setNewMessage("");

    // Create message instantly for UI (Optimistic Update)
    const tempId = crypto.randomUUID();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      sender_id: user.id,
      message: msg,
      created_at: new Date().toISOString()
    };
    
    // Add to UI immediately
    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 10);

    try {
        const { error } = await supabase.from("chat_messages").insert({
          id: tempId, // Pass the same ID to prevent duplicates when Supabase echoes it back
          ride_request_id: requestId,
          sender_id: user.id,
          message: msg,
        });

        if (error) {
           // Revert pessimistic UI update if failed
           setMessages(prev => prev.filter(m => m.id !== tempId));
           if (error.code === '42P01') {
               toast.error("Chat Feature is disabled right now.");
           } else {
               toast.error("Failed to send message: " + error.message);
           }
        }
    } catch(err: any) {
        console.error(err);
    }
  };

  return (
    <Layout>
      <div className="container max-w-2xl py-8 h-[calc(100vh-100px)] flex flex-col">
        <Button variant="ghost" onClick={() => navigate(-1)} className="w-fit mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card className="flex flex-col flex-1 shadow-elevated overflow-hidden border-t-4 border-t-primary">
          <CardHeader className="bg-muted/30 border-b pb-4">
            <CardTitle className="font-display flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Ride Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
             <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10">
               {messages.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                    <MessageSquare className="h-12 w-12 mb-2" />
                    <p>No messages yet. Say hi!</p>
                 </div>
               ) : (
                 messages.map((msg) => {
                   const isMe = msg.sender_id === user?.id;
                   return (
                     <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card text-card-foreground shadow-sm border rounded-tl-sm'}`}>
                           <p className="text-sm">{msg.message}</p>
                           <span className={`text-[10px] opacity-70 mt-1 block ${isMe ? 'text-right' : 'text-left'}`}>
                             {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </span>
                        </div>
                     </div>
                   );
                 })
               )}
               <div ref={messagesEndRef} />
             </div>
             <form onSubmit={handleSendMessage} className="p-4 bg-background border-t flex gap-2">
                <Input
                  className="flex-1 rounded-full px-4 border-muted-foreground/20 focus-visible:ring-primary/50"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <Button type="submit" size="icon" className="rounded-full h-10 w-10 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!newMessage.trim()}>
                   <Send className="h-4 w-4 ml-0.5" />
                </Button>
             </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
