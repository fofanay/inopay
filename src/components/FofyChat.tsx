import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Trash2, HelpCircle, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import fofyAvatar from "@/assets/fofy-avatar.jpeg";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface FAQCategory {
  icon: string;
  name: string;
  questions: string[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fofy-chat`;
const STORAGE_KEY = "fofy-chat-history";

const FofyChat = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FAQCategory | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // FAQ categories based on language
  const faqCategories: FAQCategory[] = i18n.language === "fr" ? [
    {
      icon: "🚀",
      name: "Démarrer",
      questions: [
        "Comment fonctionne Inopay ?",
        "Comment créer un compte ?",
        "Comment analyser mon projet ?",
      ],
    },
    {
      icon: "💰",
      name: "Tarifs",
      questions: [
        "Quels sont vos tarifs ?",
        "Comment fonctionne la facturation ?",
        "Y a-t-il des frais cachés ?",
      ],
    },
    {
      icon: "🛠️",
      name: "Déploiement",
      questions: [
        "Comment déployer mon projet ?",
        "Quels hébergeurs supportez-vous ?",
        "Puis-je utiliser mon propre serveur ?",
      ],
    },
    {
      icon: "🔒",
      name: "Sécurité",
      questions: [
        "Mes données sont-elles sécurisées ?",
        "Comment fonctionne le nettoyage du code ?",
        "Qu'est-ce que le Zero-Shadow-Door ?",
      ],
    },
    {
      icon: "🔄",
      name: "Synchronisation",
      questions: [
        "Comment fonctionne la sync GitHub ?",
        "Puis-je connecter plusieurs repos ?",
        "Comment configurer le webhook ?",
      ],
    },
  ] : [
    {
      icon: "🚀",
      name: "Getting Started",
      questions: [
        "How does Inopay work?",
        "How to create an account?",
        "How to analyze my project?",
      ],
    },
    {
      icon: "💰",
      name: "Pricing",
      questions: [
        "What are your prices?",
        "How does billing work?",
        "Are there any hidden fees?",
      ],
    },
    {
      icon: "🛠️",
      name: "Deployment",
      questions: [
        "How to deploy my project?",
        "Which hosts do you support?",
        "Can I use my own server?",
      ],
    },
    {
      icon: "🔒",
      name: "Security",
      questions: [
        "Is my data secure?",
        "How does code cleaning work?",
        "What is Zero-Shadow-Door?",
      ],
    },
    {
      icon: "🔄",
      name: "Sync",
      questions: [
        "How does GitHub sync work?",
        "Can I connect multiple repos?",
        "How to configure the webhook?",
      ],
    },
  ];

  // Load conversation from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved FOFY chat:", e);
      }
    }
  }, []);

  // Save conversation to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const streamChat = async (userMessages: Message[]) => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: userMessages }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to connect to FOFY");
    }

    if (!resp.body) throw new Error("No response body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) =>
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
  };

  const handleSend = async (customMessage?: string) => {
    const messageToSend = customMessage || input.trim();
    if (!messageToSend || isLoading) return;

    // Close FAQ mode when sending a message
    setShowFAQ(false);
    setSelectedCategory(null);

    const userMessage: Message = { role: "user", content: messageToSend };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      await streamChat(newMessages);
    } catch (error) {
      console.error("FOFY error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: i18n.language === "fr" 
            ? "Désolé, une erreur s'est produite. Veuillez réessayer." 
            : "Sorry, an error occurred. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const greeting = i18n.language === "fr"
    ? "Bonjour ! Je suis FOFY, votre assistant Inopay. Comment puis-je vous aider aujourd'hui ?"
    : "Hello! I'm FOFY, your Inopay assistant. How can I help you today?";

  // Quick suggestions for initial view
  const quickSuggestions = i18n.language === "fr" ? [
    "Comment fonctionne Inopay ?",
    "Quels sont vos tarifs ?",
  ] : [
    "How does Inopay work?",
    "What are your prices?",
  ];

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-lg hover:shadow-xl transition-shadow overflow-hidden border-2 border-primary/20 hover:border-primary/40"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: isOpen ? "none" : "block" }}
      >
        <img
          src={fofyAvatar}
          alt="FOFY"
          className="w-full h-full object-cover"
        />
        <motion.div
          className="absolute -top-1 -right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <Sparkles className="w-3 h-3 text-accent-foreground" />
        </motion.div>
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
              {selectedCategory && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedCategory(null)}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/20">
                <img
                  src={fofyAvatar}
                  alt="FOFY"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">FOFY</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-accent" />
                  {i18n.language === "fr" ? "Assistant IA Inopay" : "Inopay AI Assistant"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFAQ(!showFAQ)}
                className={`h-8 w-8 ${showFAQ ? 'text-primary' : 'text-muted-foreground'}`}
                title={i18n.language === "fr" ? "FAQ" : "FAQ"}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearHistory}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title={i18n.language === "fr" ? "Effacer l'historique" : "Clear history"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* FAQ Mode */}
            {showFAQ ? (
              <ScrollArea className="flex-1 p-4">
                {selectedCategory ? (
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                      <span>{selectedCategory.icon}</span>
                      {selectedCategory.name}
                    </h4>
                    {selectedCategory.questions.map((question, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setShowFAQ(false);
                          setSelectedCategory(null);
                          handleSend(question);
                        }}
                        className="w-full text-left text-sm px-4 py-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-colors"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground mb-3">
                      {i18n.language === "fr" ? "Questions fréquentes" : "Frequently Asked Questions"}
                    </h4>
                    {faqCategories.map((category, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedCategory(category)}
                        className="w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-colors"
                      >
                        <span className="text-xl">{category.icon}</span>
                        <div>
                          <p className="font-medium text-foreground text-sm">{category.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {category.questions.length} {i18n.language === "fr" ? "questions" : "questions"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            ) : (
              /* Messages */
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {/* Initial greeting */}
                  {messages.length === 0 && (
                    <>
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-primary/20">
                          <img
                            src={fofyAvatar}
                            alt="FOFY"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-2 max-w-[80%]">
                          <p className="text-sm text-foreground">{greeting}</p>
                        </div>
                      </div>
                      
                      {/* Quick suggestions */}
                      <div className="flex flex-wrap gap-2 mt-3 pl-11">
                        {quickSuggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSend(suggestion)}
                            className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                        <button
                          onClick={() => setShowFAQ(true)}
                          className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          <HelpCircle className="w-3 h-3" />
                          {i18n.language === "fr" ? "Voir la FAQ" : "View FAQ"}
                        </button>
                      </div>
                    </>
                  )}

                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-primary/20">
                          <img
                            src={fofyAvatar}
                            alt="FOFY"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2 max-w-[80%] ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-muted/50 rounded-tl-sm"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}

                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-primary/20">
                        <img
                          src={fofyAvatar}
                          alt="FOFY"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex gap-1">
                          <motion.div
                            className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                          />
                          <motion.div
                            className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                          />
                          <motion.div
                            className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}

            {/* Input */}
            <div className="p-4 border-t border-border bg-muted/10">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    i18n.language === "fr"
                      ? "Posez votre question..."
                      : "Ask your question..."
                  }
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FofyChat;
