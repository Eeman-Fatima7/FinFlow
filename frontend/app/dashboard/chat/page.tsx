'use client';

import { FormEvent, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, TrendingUp, PiggyBank, Lightbulb, DollarSign } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ApiError, apiRequest, resolveAiApiErrorMessage } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type StructuredContextMeta = {
  generated_at?: string;
  confirmed_count?: number;
  predicted_count?: number;
  uncertain_count?: number;
  quality_flags?: string[];
};

type ProposedAction = {
  proposal_id: string;
  type: 'create_budget' | 'update_budget' | 'create_goal' | 'update_goal';
  payload: Record<string, unknown>;
  confirmation_summary: string;
  status: 'pending' | 'rejected' | 'expired' | 'executed' | 'failed';
  expires_at?: string;
};

type ActionDecision = 'confirm' | 'reject';

type ActionResult = {
  proposal_id: string;
  decision: ActionDecision;
  status: string;
  executed: boolean;
  type: ProposedAction['type'];
  confirmation_summary: string;
  result?: Record<string, unknown>;
  executed_at?: string;
  correlation_id?: string;
};

/** Returns true if the text looks like a real assistant reply, not a provider fragment. */
const isValidAssistantReply = (text: string | undefined | null): boolean => {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Reject obvious loading/fragment artifacts
  if (trimmed.length < 3) return false;
  if (/^<[^>]+>$/.test(trimmed)) return false;
  if (/^(load|Loading|LOADING|loading|please wait)/i.test(trimmed)) return false;
  return true;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
  contextMeta?: StructuredContextMeta | null;
  proposedAction?: ProposedAction | null;
  actionState?: 'idle' | 'confirming' | 'confirmed' | 'rejected' | 'failed';
};

const promptCards = [
  { icon: TrendingUp, text: 'How can I reduce my monthly expenses?', color: 'from-[#86efac] to-[#67e8f9]' },
  { icon: PiggyBank, text: 'Help me plan for a 10,000 emergency fund', color: 'from-[#c084fc] to-[#f9a8d4]' },
  { icon: Lightbulb, text: 'Analyze my spending patterns this month', color: 'from-[#67e8f9] to-[#93c5fd]' },
  { icon: DollarSign, text: 'What is my biggest spending category?', color: 'from-[#f9a8d4] to-[#93c5fd]' },
];

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const summarizeActionOutcome = (result: ActionResult): string => {
  if (result.decision === 'reject') {
    return 'Action rejected. No database changes were made.';
  }

  if (result.executed && result.status === 'executed') {
    if (result.type === 'create_budget' || result.type === 'update_budget') {
      return 'Budget action confirmed and saved successfully.';
    }

    return 'Goal action confirmed and saved successfully.';
  }

  return `Action could not be completed (status: ${result.status}).`;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hi! I'm your AI financial advisor. I can help you understand spending, savings, goals, and budgeting decisions. What would you like to review today?",
      time: now(),
      proposedAction: null,
      actionState: 'idle',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canShowPrompts = useMemo(() => messages.length <= 1, [messages.length]);

  const appendSystemAssistantMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text,
        time: now(),
        proposedAction: null,
        actionState: 'idle',
      },
    ]);
  };

  const updateActionState = (proposalId: string, actionState: ChatMessage['actionState']) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.proposedAction?.proposal_id !== proposalId) {
          return message;
        }

        const nextProposalStatus =
          actionState === 'confirmed'
            ? 'executed'
            : actionState === 'rejected'
              ? 'rejected'
              : actionState === 'failed'
                ? 'failed'
                : message.proposedAction.status;

        return {
          ...message,
          actionState,
          proposedAction: {
            ...message.proposedAction,
            status: nextProposalStatus,
          },
        };
      })
    );
  };

  const handleActionDecision = async (proposal: ProposedAction, decision: ActionDecision) => {
    if (loading) return;

    updateActionState(proposal.proposal_id, 'confirming');
    setError(null);

    try {
      const result = await apiRequest<ActionResult>('/ai/actions/confirm', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          proposal_id: proposal.proposal_id,
          decision,
        }),
      });

      updateActionState(proposal.proposal_id, decision === 'confirm' ? 'confirmed' : 'rejected');
      appendSystemAssistantMessage(summarizeActionOutcome(result));
    } catch (err) {
      updateActionState(proposal.proposal_id, 'failed');

      if (err instanceof ApiError) {
        setError(resolveAiApiErrorMessage(err) || err.message);
      } else {
        setError('Failed to process action confirmation');
      }
    }
  };

  const sendMessage = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text,
        time: now(),
        proposedAction: null,
        actionState: 'idle',
      },
    ]);

    setInputValue('');
    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest<{
        reply: string;
        context?: {
          structured_context_meta?: StructuredContextMeta;
        };
        proposed_actions?: ProposedAction[];
        requires_confirmation?: boolean;
      }>('/ai/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ message: text }),
      });

      const firstProposal = Array.isArray(data.proposed_actions) && data.proposed_actions.length > 0
        ? data.proposed_actions[0]
        : null;

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: data.reply,
          time: now(),
          contextMeta: data.context?.structured_context_meta || null,
          proposedAction: firstProposal,
          actionState: firstProposal ? 'idle' : 'idle',
        },
      ]);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(resolveAiApiErrorMessage(err) || err.message);
      } else {
        setError('Failed to send message');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await sendMessage(inputValue);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <Card className="p-6 rounded-3xl border-2 bg-gradient-to-br from-[#dcfce7] via-[#cffafe] to-[#dbeafe]">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">AI Financial Advisor</h2>
              <p className="text-sm text-foreground/70">
                Get personalized insights, budget guidance, and recommendations from your real data.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden mb-6 space-y-4 scrollbar-soft">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] min-w-0 ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                <Card
                  className={`p-4 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-[#86efac] to-[#67e8f9] text-white border-0'
                      : 'bg-white border-2'
                  }`}
                >
                  {message.role === 'assistant'
                    ? isValidAssistantReply(message.text)
                      ? (
                        <div className="whitespace-pre-line break-words leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-medium [&_h1]:mt-4 [&_h2]:mt-3 [&_h3]:mt-2 [&_h1]:mb-2 [&_h2]:mb-1 [&_h3]:mb-1 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:p-2 [&_td]:p-2 [&_hr]:my-4 [&_strong]:font-semibold">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                        </div>
                      )
                      : (
                        <p className="whitespace-pre-line break-words leading-relaxed text-foreground/60 italic">
                          [Response was interrupted. Please try again.]
                        </p>
                      )
                    : (
                      <p className="whitespace-pre-line break-words leading-relaxed">{message.text}</p>
                    )}

                  {message.role === 'assistant' && message.proposedAction && (
                    <div className="mt-3 p-3 rounded-xl border border-foreground/10 bg-accent/40">
                      <p className="text-sm font-semibold mb-1">Proposed action</p>
                      <p className="text-sm text-foreground/80 break-words">{message.proposedAction.confirmation_summary}</p>
                      <p className="text-xs text-foreground/60 mt-1">Type: {message.proposedAction.type}</p>
                      {message.proposedAction.expires_at && (
                        <p className="text-xs text-foreground/50">Expires: {new Date(message.proposedAction.expires_at).toLocaleString()}</p>
                      )}

                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="rounded-lg"
                          disabled={message.actionState === 'confirming' || message.actionState === 'confirmed' || message.actionState === 'rejected'}
                          onClick={() => void handleActionDecision(message.proposedAction as ProposedAction, 'confirm')}
                        >
                          {message.actionState === 'confirming' ? 'Processing...' : 'Confirm'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          disabled={message.actionState === 'confirming' || message.actionState === 'confirmed' || message.actionState === 'rejected'}
                          onClick={() => void handleActionDecision(message.proposedAction as ProposedAction, 'reject')}
                        >
                          Reject
                        </Button>
                      </div>

                      {message.actionState === 'confirmed' && (
                        <p className="text-xs text-green-700 mt-2">Confirmed and executed.</p>
                      )}
                      {message.actionState === 'rejected' && (
                        <p className="text-xs text-foreground/70 mt-2">Rejected. No changes saved.</p>
                      )}
                      {message.actionState === 'failed' && (
                        <p className="text-xs text-red-600 mt-2">Failed to process this action.</p>
                      )}
                    </div>
                  )}

                  {message.role === 'assistant' && message.contextMeta && (
                    <p className="text-xs mt-2 text-foreground/60">
                      Confidence view • confirmed {message.contextMeta.confirmed_count ?? 0} • predicted {message.contextMeta.predicted_count ?? 0} • uncertain {message.contextMeta.uncertain_count ?? 0}
                    </p>
                  )}
                  <div
                    className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-white/70' : 'text-foreground/40'
                    }`}
                  >
                    {message.time}
                  </div>
                </Card>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
            <Card className="p-4 rounded-2xl border-2 bg-white">
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </Card>
          </motion.div>
        )}

        {canShowPrompts && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid md:grid-cols-2 gap-3 mt-6"
          >
            {promptCards.map((prompt, index) => (
              <motion.button
                key={index}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => void sendMessage(prompt.text)}
                className="text-left"
              >
                <Card className="p-4 rounded-2xl border-2 hover:shadow-lg transition-all">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${prompt.color} flex items-center justify-center flex-shrink-0`}
                    >
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

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-4 rounded-3xl border-2 bg-white">
          <form className="flex gap-3" onSubmit={handleSubmit}>
            <Input
              placeholder="Ask me anything about your finances..."
              className="flex-1 bg-accent/50 border-0 rounded-xl"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(inputValue);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] hover:opacity-90"
              disabled={loading}
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>

          {error && <p className="text-xs text-red-600 mt-3 px-1">{error}</p>}
        </Card>
      </motion.div>
    </div>
  );
}
