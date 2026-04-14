import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { X, Send, Minimize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import fofyAvatar from "@/assets/fofy-avatar.jpeg";

type Msg = { role: "user" | "assistant"; content: string };

const FOFY_URL = `${import.meta.env.VITE_API_URL || 'https://api.getinopay.com'}/functions/fofy-chat`;
const HIDDEN_ROUTES: string[] = [];
const WELCOME_MSG: Msg = {
  role: "assistant",
  content:
    "Bonjour ! 👋 Je suis **FOFY**, votre assistant INOPAY.\n\n🎯 **Investisseur ?** Je peux vous aider à commencer à investir.\n\n🏛️ **Institution financière ?** Je peux vous présenter comment INOPAY peut apporter de nouveaux investisseurs à votre institution.\n\nComment puis-je vous aider ?",
};

export const FofyAssistant: React.FC = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const shouldHide = HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r));

  // Load conversation history on mount
  useEffect(() => {
    if (historyLoaded) return;
    const loadHistory = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHistoryLoaded(true); return; }

      const { data: convs } = await supabase
        .from("fofy_conversations")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (convs && convs.length > 0) {
        const convId = convs[0].id;
        setConversationId(convId);

        const { data: msgs } = await supabase
          .from("fofy_messages")
          .select("sender, message")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true });

        if (msgs && msgs.length > 0) {
          const loaded: Msg[] = msgs.map((m: any) => ({
            role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
            content: m.message,
          }));
          setMessages(loaded);
        }
      }
      setHistoryLoaded(true);
    };
    loadHistory();
  }, [historyLoaded]);

  // Realtime subscription for new proactive messages
  useEffect(() => {
    const channel = supabase
      .channel("fofy-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fofy_messages" }, async (payload) => {
        const msg = payload.new as any;
        if (msg.sender === "fofy") {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data: conv } = await supabase
            .from("fofy_conversations")
            .select("user_id")
            .eq("id", msg.conversation_id)
            .maybeSingle();
          if (conv && (conv as any).user_id === user.id) {
            setMessages((prev) => [...prev, { role: "assistant", content: msg.message }]);
            if (!hidden) setOpen(true);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hidden]);

  if (shouldHide || hidden) return null;

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
  };

  const getOrCreateConversation = async (): Promise<string | null> => {
    if (conversationId) return conversationId;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("fofy_conversations")
      .insert({ user_id: user.id })
      .select("id")
      .single();

    if (error || !data) return null;
    setConversationId(data.id);
    return data.id;
  };

  const saveMessage = async (convId: string, sender: string, message: string) => {
    await supabase.from("fofy_messages").insert({
      conversation_id: convId,
      sender,
      message,
    });
  };

  const handleNewConversation = async () => {
    setConversationId(null);
    setMessages([WELCOME_MSG]);
    setInput("");
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    scrollToBottom();

    // Get or create conversation & save user message
    const convId = await getOrCreateConversation();
    if (convId) await saveMessage(convId, "user", text);

    // Track funnel interaction
    const isSgiPath = ["/partners", "/sgi"].some((p) => location.pathname.startsWith(p));
    const funnelContext = isSgiPath ? "sgi" : "investor";
    try {
      await supabase.from("investor_funnel_events").insert({
        event_type: `fofy_chat_${funnelContext}`,
        metadata: { page: location.pathname, query: text },
      });
    } catch {}

    let assistantSoFar = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(FOFY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Erreur" }));
        const errMsg = err.error || "Désolé, une erreur s'est produite.";
        setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && prev.length > 1 && prev[prev.length - 2]?.role === "user") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
        scrollToBottom();
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Save assistant response
      if (convId && assistantSoFar) {
        await saveMessage(convId, "fofy", assistantSoFar);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Désolé, je suis temporairement indisponible. 🙏" }]);
    }
    setIsLoading(false);
  };

  const handleHide = () => {
    setOpen(false);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg hover:scale-105 transition-transform md:h-16 md:w-16"
          aria-label="Ouvrir FOFY"
        >
          <img src={fofyAvatar} alt="FOFY" className="h-full w-full rounded-full object-cover" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-[9999] flex w-[calc(100vw-2.5rem)] max-w-sm flex-col rounded-2xl border bg-card shadow-xl sm:w-96 animate-fade-in">
          <div className="flex items-center gap-3 rounded-t-2xl bg-primary px-4 py-3">
            <img src={fofyAvatar} alt="FOFY" className="h-9 w-9 rounded-full object-cover border-2 border-primary-foreground/30" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary-foreground">FOFY</p>
              <p className="text-xs text-primary-foreground/70">Assistant INOPAY</p>
            </div>
            <button onClick={handleNewConversation} className="p-1 text-primary-foreground/70 hover:text-primary-foreground" title="Nouvelle conversation">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button onClick={handleHide} className="p-1 text-primary-foreground/70 hover:text-primary-foreground" title="Masquer">
              <Minimize2 className="h-4 w-4" />
            </button>
            <button onClick={() => setOpen(false)} className="p-1 text-primary-foreground/70 hover:text-primary-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ maxHeight: "60vh", minHeight: "250px" }}>
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none [&_p]:m-0">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : m.content}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-3 py-2 text-sm text-muted-foreground">
                  <span className="animate-pulse">FOFY réfléchit...</span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2 border-t px-3 py-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" variant="ghost" disabled={!input.trim() || isLoading} className="h-8 w-8">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};
