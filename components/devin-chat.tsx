"use client";

import { useState, useEffect, useRef } from "react";
import { SendIcon, Loader2Icon, BotIcon, UserIcon, ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

interface DevinChatProps {
  sessionId: string;
  sessionUrl: string;
  onClose?: () => void;
  className?: string;
}

export function DevinChat({ sessionId, sessionUrl, onClose, className }: DevinChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll for conversation updates
  useEffect(() => {
    let mounted = true;

    const fetchConversation = async () => {
      try {
        const response = await fetch(`/api/devin/chat/${sessionId}`);
        if (!response.ok) return;
        
        const data = await response.json();
        if (mounted && data.conversation) {
          // Transform Devin conversation to our format
          const formattedMessages: Message[] = data.conversation.map((msg: { role?: string; content?: string; message?: string; type?: string }) => ({
            role: msg.role === "user" ? "user" : msg.role === "devin" ? "assistant" : "system",
            content: msg.content || msg.message || "",
          }));
          setMessages(formattedMessages);
        }
      } catch (err) {
        console.error("Failed to fetch conversation:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchConversation();
    const interval = setInterval(fetchConversation, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    // Optimistically add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch(`/api/devin/chat/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      // Could show error state here
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn("flex flex-col rounded-xl border border-border/50 bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "#1FAF8C" }}>
            <BotIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium">Chat with Devin</p>
            <p className="text-xs text-muted-foreground">Provide clarification if needed</p>
          </div>
        </div>
        <a
          href={sessionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLinkIcon className="h-3.5 w-3.5" />
          Open Full Session
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2Icon className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BotIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Devin is working on your documentation fixes.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Send a message if you need to provide clarification.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200",
                msg.role === "user" && "flex-row-reverse"
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  msg.role === "user" ? "bg-primary" : "bg-[#1FAF8C]"
                )}
              >
                {msg.role === "user" ? (
                  <UserIcon className="h-3.5 w-3.5 text-primary-foreground" />
                ) : (
                  <BotIcon className="h-3.5 w-3.5 text-white" />
                )}
              </div>
              <div
                className={cn(
                  "rounded-xl px-3.5 py-2 text-sm max-w-[85%]",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-border/50 p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message to Devin..."
            disabled={sending}
            className="flex-1 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#0194E5" }}
          >
            {sending ? (
              <Loader2Icon className="h-4 w-4 text-white animate-spin" />
            ) : (
              <SendIcon className="h-4 w-4 text-white" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
