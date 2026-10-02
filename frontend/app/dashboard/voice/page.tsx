'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Check, X, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { ApiError, apiRequest, resolveAiApiErrorMessage } from '@/lib/api';
import { formatMoney, usePreferences } from '@/lib/preferences';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type StructuredContextMeta = {
  generated_at?: string;
  confirmed_count?: number;
  predicted_count?: number;
  uncertain_count?: number;
  quality_flags?: string[];
};

type VoiceContext = {
  month: number;
  year: number;
  income: number;
  total_expenses: number;
  savings: number;
  savings_rate: number;
  structured_context_meta?: StructuredContextMeta;
};

type VoiceResponse = {
  transcript: string;
  reply: string;
  context: VoiceContext;
};


export default function VoicePage() {
  const { preferences } = usePreferences();
  const moneyFormatter = (value: number) =>
    formatMoney(Math.round(value || 0), preferences.currency, preferences.language);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [supported, setSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');

  const [reply, setReply] = useState<string | null>(null);
  const [context, setContext] = useState<VoiceContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const speechWindow = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };

    const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalChunk = '';
      let interimChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = String(event.results[i][0]?.transcript || '').trim();
        if (!chunk) continue;

        if (event.results[i].isFinal) {
          finalChunk += `${chunk} `;
        } else {
          interimChunk += `${chunk} `;
        }
      }

      if (finalChunk) {
        setTranscript((prev) => `${prev} ${finalChunk}`.trim());
      }

      setInterimTranscript(interimChunk.trim());
    };

    recognition.onerror = (event: { error?: string }) => {
      setIsListening(false);
      setError(`Voice recognition error: ${event.error || 'unknown error'}`);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // no-op
      }
    };
  }, []);

  const startListening = () => {
    if (!recognitionRef.current || isSending) return;

    setError(null);
    setInterimTranscript('');

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setError('Could not start microphone. If it is already running, stop and try again.');
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
    } catch {
      // no-op
    }
  };

  const clearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
    setReply(null);
    setContext(null);
    setError(null);
  };

  const sendVoiceQuery = async () => {
    const mergedTranscript = `${transcript} ${interimTranscript}`.trim();

    if (!mergedTranscript || isSending) {
      setError('Record voice (or edit transcript) before sending.');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const data = await apiRequest<VoiceResponse>('/ai/voice', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ transcript: mergedTranscript }),
      });

      setTranscript(data.transcript || mergedTranscript);
      setInterimTranscript('');
      setReply(data.reply);
      setContext(data.context);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(resolveAiApiErrorMessage(err) || err.message);
      } else {
        setError('Failed to process voice query');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <h2 className="text-3xl font-bold mb-2">Voice Input</h2>
        <p className="text-foreground/60">Add transactions naturally using your voice</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
        <Card className="p-12 rounded-3xl border-2 bg-gradient-to-br from-white to-accent/30">
          <div className="flex flex-col items-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={isListening ? stopListening : startListening}
              disabled={!supported || isSending}
              className="relative mb-8"
            >
              <div
                className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-gradient-to-br from-[#86efac] to-[#67e8f9] animate-pulse'
                    : 'bg-gradient-to-br from-[#c084fc] to-[#f9a8d4] hover:shadow-2xl'
                }`}
              >
                {isListening ? <MicOff className="w-16 h-16 text-white" /> : <Mic className="w-16 h-16 text-white" />}
              </div>

              {isListening && (
                <div className="absolute -inset-4 flex items-center justify-center gap-1">
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-[#67e8f9] rounded-full"
                      animate={{ height: [20, 40, 20] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                    />
                  ))}
                </div>
              )}
            </motion.button>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">
                {isListening ? 'Listening...' : transcript ? 'Review Transcript' : 'Tap to Start'}
              </h3>
              <p className="text-sm text-foreground/60">
                {isListening
                  ? 'Speak naturally about your transaction'
                  : transcript
                    ? 'Edit transcript if needed, then send to advisor'
                    : 'Say something like “I spent 45 at Starbucks”'}
              </p>
            </motion.div>

            <AnimatePresence mode="wait">
              {transcript && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full mb-6"
                >
                  <Card className="p-6 rounded-2xl bg-white border-2">
                    <div className="text-sm text-foreground/60 mb-2">Transcript</div>
                    <textarea
                      className="w-full rounded-xl border bg-background px-3 py-2 text-base resize-none"
                      rows={4}
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                    />
                    {interimTranscript && <p className="text-xs text-foreground/50 mt-2">Live: {interimTranscript}</p>}
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="w-full grid sm:grid-cols-2 gap-3">
              <Button className="rounded-xl" onClick={() => void sendVoiceQuery()} disabled={isSending || !transcript.trim()}>
                <Check className="mr-2 h-5 w-5" />
                {isSending ? 'Sending...' : 'Send to Advisor'}
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={clearTranscript} disabled={isSending}>
                <X className="mr-2 h-5 w-5" />
                Clear
              </Button>
            </div>

            {!supported && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-4 w-full text-center">
                Voice recognition is not supported in this browser. You can still paste transcript text and send.
              </p>
            )}

            {reply && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full mt-6">
                <Card className="p-4 rounded-2xl border-2 bg-white">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Advisor Reply</div>
                      <div className="text-xs text-foreground/50">Generated from /ai/voice</div>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{reply}</p>
                  {context && (
                    <>
                      <p className="mt-3 text-xs text-foreground/60">
                        {context.month}/{context.year} • Income {moneyFormatter(context.income)} • Expenses{' '}
                        {moneyFormatter(context.total_expenses)} • Savings {moneyFormatter(context.savings)} ({context.savings_rate}%)
                      </p>
                      {context.structured_context_meta && (
                        <p className="mt-2 text-xs text-foreground/55">
                          Confidence view • confirmed {context.structured_context_meta.confirmed_count ?? 0} • predicted {context.structured_context_meta.predicted_count ?? 0} • uncertain {context.structured_context_meta.uncertain_count ?? 0}
                        </p>
                      )}
                    </>
                  )}
                </Card>
              </motion.div>
            )}

            {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

            <Link href="/dashboard/chat" className="inline-block mt-5 rounded-md border px-3 py-2 text-sm hover:bg-zinc-100">
              Go to AI Chat
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
