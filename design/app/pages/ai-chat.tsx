import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { 
  Send, 
  Sparkles,
  TrendingUp,
  PiggyBank,
  Lightbulb,
  DollarSign
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";

const suggestedPrompts = [
  { icon: TrendingUp, text: "How can I reduce my monthly expenses?", color: "from-[#86efac] to-[#67e8f9]" },
  { icon: PiggyBank, text: "Help me plan for a $10,000 emergency fund", color: "from-[#c084fc] to-[#f9a8d4]" },
  { icon: Lightbulb, text: "Analyze my spending patterns", color: "from-[#67e8f9] to-[#93c5fd]" },
  { icon: DollarSign, text: "What's my biggest spending category?", color: "from-[#f9a8d4] to-[#93c5fd]" },
];

type Message = {
  id: number;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
};

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'ai',
      content: "Hi! I'm your AI financial advisor. I can help you understand your spending, create budgets, set goals, and give you personalized money tips. How can I help you today?",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: messages.length + 2,
        type: 'ai',
        content: getAIResponse(text),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const getAIResponse = (prompt: string) => {
    const lower = prompt.toLowerCase();
    
    if (lower.includes('reduce') || lower.includes('expenses')) {
      return "Based on your spending data, I notice you're spending $340/month on subscriptions. Here are some suggestions:\n\n✓ You have 3 streaming services - consider keeping just 1-2\n✓ Gym membership unused for 2 months - consider canceling or freezing\n✓ Dining out: $450/month - try meal prepping 2-3 days/week to save ~$150\n\nThese changes could save you approximately $240/month or $2,880/year!";
    }
    
    if (lower.includes('emergency fund') || lower.includes('10000') || lower.includes('10,000')) {
      return "Great goal! Let me create a plan for your $10,000 emergency fund:\n\n💰 Current savings: $5,155\n💰 Remaining needed: $4,845\n\nBased on your average monthly surplus of $450:\n\n📅 Target completion: ~11 months (Jan 2027)\n📊 Suggested monthly savings: $440\n\nTips to reach your goal faster:\n• Set up automatic transfers on payday\n• Save any bonuses or tax refunds\n• Consider a high-yield savings account (4.5% APY)\n\nWould you like me to set up this goal in your Goals page?";
    }
    
    if (lower.includes('spending patterns') || lower.includes('analyze')) {
      return "Here's what I found analyzing your last 3 months:\n\n📊 Spending Insights:\n\n🟢 Good habits:\n• Consistent savings of $450-500/month\n• Bills paid on time (100%)\n• Grocery spending stable at $400/month\n\n🟡 Areas to watch:\n• Shopping increased 25% last month\n• Weekend spending is 2x higher than weekdays\n• Coffee/dining out: $120/month\n\n💡 Recommendation: Try the \"48-hour rule\" for purchases over $50 to reduce impulse buying.";
    }
    
    if (lower.includes('biggest') && lower.includes('category')) {
      return "Your biggest spending category is Housing at $1,800/month (42% of expenses).\n\nHere's your category breakdown:\n\n1. 🏠 Housing: $1,800/month\n2. 🍔 Food & Dining: $570/month\n3. 🚗 Transportation: $320/month\n4. 📱 Subscriptions: $340/month\n5. 🛍️ Shopping: $215/month\n\nYour housing cost is within the recommended 30% of your income. Great job! The next highest category (Food & Dining) might have room for optimization.";
    }
    
    return "I understand your question. Based on your financial data, I can help you with budgeting, spending analysis, goal planning, and personalized recommendations. Could you tell me more specifically what you'd like to know?";
  };

  const handlePromptClick = (prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
      {/* Chat header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-[#dcfce7] via-[#cffafe] to-[#dbeafe]">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">AI Financial Advisor</h2>
              <p className="text-sm text-foreground/70">
                Get personalized insights, budget tips, and smart recommendations powered by AI
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Chat messages */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden mb-6 space-y-4 scrollbar-soft">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] min-w-0 ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                <Card 
                  className={`p-4 rounded-2xl ${ 
                    message.type === 'user' 
                      ? 'bg-gradient-to-br from-[#86efac] to-[#67e8f9] text-white border-0' 
                      : 'bg-white border-2'
                  }`}
                >
                  <p className="whitespace-pre-line break-words leading-relaxed">{message.content}</p>
                  <div className={`text-xs mt-2 ${message.type === 'user' ? 'text-white/70' : 'text-foreground/40'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </Card>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <Card className="p-4 rounded-2xl border-2 bg-white">
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </Card>
          </motion.div>
        )}

        {/* Suggested prompts (show only if no messages yet or just welcome message) */}
        {messages.length <= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid md:grid-cols-2 gap-3 mt-6"
          >
            {suggestedPrompts.map((prompt, index) => (
              <motion.button
                key={index}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handlePromptClick(prompt.text)}
                className="text-left"
              >
                <Card className="p-4 rounded-2xl border-2 hover:shadow-lg transition-all">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${prompt.color} flex items-center justify-center flex-shrink-0`}>
                      <prompt.icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm font-medium leading-relaxed">{prompt.text}</p>
                  </div>
                </Card>
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Input area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-4 rounded-3xl border-2 bg-white">
          <div className="flex gap-3">
            <Input
              placeholder="Ask me anything about your finances..."
              className="flex-1 bg-accent/50 border-0 rounded-xl"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }
              }}
            />
            <Button 
              size="icon" 
              className="rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] hover:opacity-90"
              onClick={() => handleSendMessage(inputValue)}
              disabled={isTyping}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs text-foreground/40 mt-3 px-1">
            Press Enter to send • AI responses are simulated for demo purposes
          </p>
        </Card>
      </motion.div>
    </div>
  );
}