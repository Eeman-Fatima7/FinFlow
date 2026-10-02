import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Mic, 
  MicOff,
  Check,
  X,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";

const exampleCommands = [
  "I spent $45 at Starbucks",
  "Add $150 grocery expense",
  "Record $3,200 salary payment",
  "I bought coffee for $8.50",
  "$120 for electric bill",
  "Paid $89 for gas"
];

export function VoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsedData, setParsedData] = useState<{
    amount: string;
    merchant: string;
    category: string;
  } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleStartListening = () => {
    setIsListening(true);
    setTranscript("");
    setParsedData(null);
    setShowSuccess(false);

    // Simulate voice recognition
    setTimeout(() => {
      const example = exampleCommands[Math.floor(Math.random() * exampleCommands.length)];
      simulateTyping(example);
    }, 500);
  };

  const simulateTyping = (text: string) => {
    let index = 0;
    const interval = setInterval(() => {
      if (index <= text.length) {
        setTranscript(text.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
        setIsListening(false);
        parseTranscript(text);
      }
    }, 50);
  };

  const parseTranscript = (text: string) => {
    const amountMatch = text.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    const amount = amountMatch ? amountMatch[1] : "0";
    
    let merchant = "Unknown";
    let category = "Other";

    if (text.toLowerCase().includes("starbucks") || text.toLowerCase().includes("coffee")) {
      merchant = "Starbucks";
      category = "Food & Drink";
    } else if (text.toLowerCase().includes("grocery") || text.toLowerCase().includes("groceries")) {
      merchant = "Grocery Store";
      category = "Groceries";
    } else if (text.toLowerCase().includes("salary") || text.toLowerCase().includes("payment")) {
      merchant = "Salary Deposit";
      category = "Income";
    } else if (text.toLowerCase().includes("electric") || text.toLowerCase().includes("bill")) {
      merchant = "Electric Bill";
      category = "Bills";
    } else if (text.toLowerCase().includes("gas")) {
      merchant = "Gas Station";
      category = "Transportation";
    }

    setParsedData({ amount, merchant, category });
  };

  const handleConfirm = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setTranscript("");
      setParsedData(null);
    }, 2000);
  };

  const handleCancel = () => {
    setTranscript("");
    setParsedData(null);
    setIsListening(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <h2 className="text-3xl font-bold mb-2">Voice Input</h2>
        <p className="text-foreground/60">
          Add transactions naturally using your voice
        </p>
      </motion.div>

      {/* Main voice interface */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-12 rounded-3xl border-2 bg-gradient-to-br from-white to-accent/30">
          <div className="flex flex-col items-center">
            {/* Mic button with animation */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={isListening ? undefined : handleStartListening}
              disabled={isListening}
              className="relative mb-8"
            >
              <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                isListening 
                  ? 'bg-gradient-to-br from-[#86efac] to-[#67e8f9] animate-pulse' 
                  : 'bg-gradient-to-br from-[#c084fc] to-[#f9a8d4] hover:shadow-2xl'
              }`}>
                {isListening ? (
                  <MicOff className="w-16 h-16 text-white" />
                ) : (
                  <Mic className="w-16 h-16 text-white" />
                )}
              </div>

              {/* Waveform animation */}
              {isListening && (
                <div className="absolute -inset-4 flex items-center justify-center gap-1">
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-[#67e8f9] rounded-full"
                      animate={{
                        height: [20, 40, 20],
                      }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.button>

            {/* Status text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mb-6"
            >
              <h3 className="text-xl font-semibold mb-2">
                {isListening ? "Listening..." : parsedData ? "Review Transaction" : "Tap to Start"}
              </h3>
              <p className="text-sm text-foreground/60">
                {isListening ? "Speak naturally about your transaction" : parsedData ? "Confirm or edit the details below" : "Say something like \"I spent $45 at Starbucks\""}
              </p>
            </motion.div>

            {/* Transcript display */}
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
                    <p className="text-lg">{transcript}</p>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Parsed data display */}
            <AnimatePresence mode="wait">
              {parsedData && !showSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full space-y-4"
                >
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="p-4 rounded-2xl bg-[#dcfce7] border-0">
                      <div className="text-xs text-foreground/60 mb-1">Amount</div>
                      <div className="text-2xl font-bold">${parsedData.amount}</div>
                    </Card>
                    <Card className="p-4 rounded-2xl bg-[#f3e8ff] border-0">
                      <div className="text-xs text-foreground/60 mb-1">Merchant</div>
                      <div className="text-lg font-bold truncate">{parsedData.merchant}</div>
                    </Card>
                    <Card className="p-4 rounded-2xl bg-[#cffafe] border-0">
                      <div className="text-xs text-foreground/60 mb-1">Category</div>
                      <div className="text-lg font-bold truncate">{parsedData.category}</div>
                    </Card>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 rounded-xl bg-gradient-to-r from-[#86efac] to-[#67e8f9] hover:opacity-90"
                      onClick={handleConfirm}
                    >
                      <Check className="mr-2 h-5 w-5" />
                      Confirm
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 rounded-xl"
                      onClick={handleCancel}
                    >
                      <X className="mr-2 h-5 w-5" />
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success message */}
            <AnimatePresence mode="wait">
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="w-full"
                >
                  <Card className="p-8 rounded-2xl bg-gradient-to-br from-[#dcfce7] to-[#cffafe] border-0 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#16a34a] flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Transaction Saved!</h3>
                    <p className="text-sm text-foreground/70">Your transaction has been added successfully</p>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>

      {/* Tips section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-8"
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Voice Command Tips</h3>
              <p className="text-sm text-foreground/60">
                Just speak naturally! Our AI understands various phrasings.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            {exampleCommands.map((command, index) => (
              <div
                key={index}
                className="p-3 rounded-xl bg-accent/50 text-sm"
              >
                "{command}"
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
