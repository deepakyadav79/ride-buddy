import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, ArrowLeft, Paperclip, Pencil, Trash2, X, Check, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  is_edited?: boolean;
  file_url?: string | null;
  file_type?: string | null;
}

export default function Chat() {
  const { requestId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // File upload state
  const [uploading, setUploading] = useState(false);

  // Context menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `ride_request_id=eq.${requestId}` },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((current) => current.map(m => m.id === updated.id ? updated : m));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages", filter: `ride_request_id=eq.${requestId}` },
        (payload) => {
          const deletedId = (payload.old as any).id;
          setMessages((current) => current.filter(m => m.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, user]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setActiveMenuId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // ─── Send Message ──────────────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !requestId) return;

    const msg = newMessage.trim();
    setNewMessage("");

    const tempId = crypto.randomUUID();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      sender_id: user.id,
      message: msg,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 10);

    try {
        const { error } = await supabase.from("chat_messages").insert({
          id: tempId,
          ride_request_id: requestId,
          sender_id: user.id,
          message: msg,
        });

        if (error) {
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

  // ─── Edit Message ──────────────────────────────────────────
  const startEdit = (msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditText(msg.message);
    setActiveMenuId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;

    const oldMessages = [...messages];
    setMessages(prev => prev.map(m => m.id === editingId ? { ...m, message: editText.trim(), is_edited: true } : m));
    setEditingId(null);
    setEditText("");

    const { error } = await supabase
      .from("chat_messages")
      .update({ message: editText.trim(), is_edited: true })
      .eq("id", editingId);

    if (error) {
      setMessages(oldMessages);
      toast.error("Failed to edit message");
    }
  };

  // ─── Delete Message ────────────────────────────────────────
  const deleteMessage = async (msgId: string) => {
    setActiveMenuId(null);
    const oldMessages = [...messages];
    setMessages(prev => prev.filter(m => m.id !== msgId));

    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("id", msgId);

    if (error) {
      setMessages(oldMessages);
      toast.error("Failed to delete message");
    } else {
      toast.success("Message deleted");
    }
  };

  // ─── File Upload ───────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !requestId) return;

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    setUploading(true);

    try {
      const ext = file.name.split('.').pop();
      const filePath = `${requestId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("chat_attachments")
        .upload(filePath, file);

      if (uploadError) {
        toast.error("Upload failed: " + uploadError.message);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("chat_attachments")
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;
      const fileType = file.type.startsWith("image/") ? "image" : "file";
      const msgText = file.name;

      const tempId = crypto.randomUUID();
      const optimistic: ChatMessage = {
        id: tempId,
        sender_id: user.id,
        message: msgText,
        created_at: new Date().toISOString(),
        file_url: fileUrl,
        file_type: fileType,
      };

      setMessages(prev => [...prev, optimistic]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 10);

      const { error: insertError } = await supabase.from("chat_messages").insert({
        id: tempId,
        ride_request_id: requestId,
        sender_id: user.id,
        message: msgText,
        file_url: fileUrl,
        file_type: fileType,
      });

      if (insertError) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        toast.error("Failed to send file: " + insertError.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong uploading file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Render a single message bubble ────────────────────────
  const renderMessage = (msg: ChatMessage) => {
    const isMe = msg.sender_id === user?.id;
    const isEditing = editingId === msg.id;

    return (
      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
        <div className="relative max-w-[80%]">
          {/* Context menu for own messages */}
          {isMe && !isEditing && (
            <div className="absolute -left-16 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(msg); }}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className={`px-4 py-2 rounded-2xl ${isMe ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card text-card-foreground shadow-sm border rounded-tl-sm'}`}>
            {/* File attachment */}
            {msg.file_url && msg.file_type === "image" && (
              <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="block mb-2">
                <img
                  src={msg.file_url}
                  alt="attachment"
                  className="max-w-full max-h-48 rounded-lg object-cover border border-white/20"
                />
              </a>
            )}
            {msg.file_url && msg.file_type === "file" && (
              <a
                href={msg.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-lg border transition-colors ${isMe ? 'border-white/20 hover:bg-white/10' : 'border-border hover:bg-muted'}`}
              >
                <FileText className="h-5 w-5 shrink-0" />
                <span className="text-xs font-medium truncate">{msg.message}</span>
              </a>
            )}

            {/* Message text or Edit input */}
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                  className="flex-1 bg-white/20 text-sm px-2 py-1 rounded-md border-0 outline-none placeholder:text-white/50"
                  autoFocus
                />
                <button onClick={saveEdit} className="p-1 hover:bg-white/20 rounded-full" title="Save"><Check className="h-4 w-4" /></button>
                <button onClick={cancelEdit} className="p-1 hover:bg-white/20 rounded-full" title="Cancel"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                {/* Don't re-show filename text for file messages because we already showed the file block */}
                {!msg.file_url && <p className="text-sm">{msg.message}</p>}
                {msg.file_url && msg.file_type === "image" && <p className="text-xs opacity-60">{msg.message}</p>}
              </>
            )}

            {/* Timestamp and edited indicator */}
            <div className={`flex items-center gap-1.5 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {msg.is_edited && <span className="text-[9px] opacity-50 italic">edited</span>}
              <span className="text-[10px] opacity-70">
                {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
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
                 messages.map(renderMessage)
               )}
               <div ref={messagesEndRef} />
             </div>

             {/* Input bar with file attach */}
             <form onSubmit={handleSendMessage} className="p-4 bg-background border-t flex gap-2 items-center">
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="rounded-full h-10 w-10 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  className="flex-1 rounded-full px-4 border-muted-foreground/20 focus-visible:ring-primary/50"
                  placeholder={uploading ? "Uploading file..." : "Type a message..."}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={uploading}
                />
                <Button type="submit" size="icon" className="rounded-full h-10 w-10 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!newMessage.trim() || uploading}>
                   <Send className="h-4 w-4 ml-0.5" />
                </Button>
             </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
