import React, { useState, useRef, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import {
  Bot, Send, User, GraduationCap, Compass, TrendingUp, Sparkles, Loader2,
} from "lucide-react";
import PageHero from "@/components/PageHero";

const CHAT_URL = `${import.meta.env.VITE_API_URL || 'https://api.getinopay.com'}/functions/ai-orchestrator`;

interface AgentDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  greeting: string;
}

const agentDefs: AgentDef[] = [
  {
    id: "onboarding",
    name: "Agent Onboarding",
    description: "Vous guide dans vos premiers pas sur INOPAY",
    icon: <Compass className="h-5 w-5" />,
    greeting: "Bienvenue sur INOPAY ! Je suis votre assistant d'accueil. Je peux vous aider à comprendre comment fonctionne la plateforme. Que souhaitez-vous savoir ?",
  },
  {
    id: "education",
    name: "Agent Éducation",
    description: "Apprenez les bases de l'investissement en Afrique de l'Ouest",
    icon: <GraduationCap className="h-5 w-5" />,
    greeting: "Bonjour ! Je suis votre assistant d'éducation financière. Je peux vous expliquer les concepts de base de l'investissement sur les marchés BRVM et BVMAC. Que voulez-vous apprendre ?",
  },
  {
    id: "suivi",
    name: "Agent Suivi",
    description: "Comprenez le suivi de vos ordres et transactions",
    icon: <TrendingUp className="h-5 w-5" />,
    greeting: "Bonjour ! Je suis votre assistant de suivi. Je peux vous renseigner sur le fonctionnement du suivi de vos investissements. Que souhaitez-vous savoir ?",
  },
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

async function streamChat({
  messages,
  agent,
  selectedModel,
  onDelta,
  onDone,
  onError,
}: {
  messages: Array<{ role: string; content: string }>;
  agent: string;
  selectedModel: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages, agent, model: selectedModel }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    onError(data.error || `Erreur ${resp.status}`);
    return;
  }

  if (!resp.body) {
    onError("Pas de réponse du serveur");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  // Flush remaining
  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }
  onDone();
}

const MODEL_OPTIONS = [
  { id: "deepseek-r1:8b", label: "DeepSeek R1 8B" },
  { id: "mistral:7b", label: "Mistral 7B" },
];

const Assistant = () => {
  const [activeAgent, setActiveAgent] = useState<AgentDef>(agentDefs[0]);
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0].id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset on agent switch
  useEffect(() => {
    setMessages([{ id: "greeting", role: "assistant", content: activeAgent.greeting }]);
  }, [activeAgent]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const allMessages = [...messages, userMsg]
      .filter((m) => m.id !== "greeting" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      const content = assistantSoFar;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.id !== "greeting") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
        }
        return [...prev, { id: crypto.randomUUID(), role: "assistant", content }];
      });
    };

    try {
      await streamChat({
        messages: allMessages,
        agent: activeAgent.id,
        selectedModel,
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
        onError: (msg) => {
          toast({ title: "Erreur", description: msg, variant: "destructive" });
          setIsLoading(false);
        },
      });
    } catch (e) {
      console.error(e);
      toast({ title: "Erreur de connexion", variant: "destructive" });
      setIsLoading(false);
    }
  }, [input, isLoading, messages, activeAgent, selectedModel]);

  return (
    <AppLayout>
      <PageHero
        badge="Assistant INOPAY"
        badgeIcon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
        title="Assistant"
        titleGradient="INOPAY"
        subtitle="IA locale (fallback cloud) — aucun conseil financier"
      >
        <div className="flex gap-1.5">
          {MODEL_OPTIONS.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedModel(m.id)}
              disabled={isLoading}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                selectedModel === m.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40"
              } ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </PageHero>

      <div className="container max-w-4xl py-8 animate-fade-in">

        {/* Agent selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {agentDefs.map((agent) => (
            <button
              key={agent.id}
              onClick={() => { if (!isLoading) setActiveAgent(agent); }}
              disabled={isLoading}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                activeAgent.id === agent.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40"
              } ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <div className={`rounded-lg p-2 ${
                activeAgent.id === agent.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}>
                {agent.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{agent.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Chat */}
        <Card className="flex flex-col" style={{ height: "480px" }}>
          <CardHeader className="border-b py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              {activeAgent.name}
              <Badge variant="default" className="ml-auto text-[10px]">
                IA
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="rounded-full bg-primary/10 p-1.5 h-7 w-7 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="rounded-full bg-secondary/10 p-1.5 h-7 w-7 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-secondary" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-2.5 justify-start">
                <div className="rounded-full bg-primary/10 p-1.5 h-7 w-7 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="rounded-2xl px-4 py-2.5 bg-muted text-muted-foreground rounded-bl-md">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </CardContent>

          {/* Input */}
          <div className="border-t p-3 flex gap-2">
            <Input
              placeholder="Posez votre question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="flex-1"
              disabled={isLoading}
            />
            <Button size="icon" onClick={send} disabled={!input.trim() || isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Les réponses sont générées par IA et ne constituent en aucun cas un conseil financier.
          INOPAY ne recommande jamais d'investissement.
        </p>
      </div>
    </AppLayout>
  );
};

export default Assistant;
