import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HelpCircle, Mail, MessageSquare, Book, Video, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api";

export function Support() {
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    if (!trimmedSubject || !trimmedMessage) {
      toast.error("Please fill in all fields");
      return;
    }

    setSubmitting(true);

    try {
      await apiRequest<{ message: string }>("/support", {
        method: "POST",
        auth: true,
        body: JSON.stringify({
          subject: trimmedSubject,
          message: trimmedMessage,
        }),
      });

      toast.success("Support request submitted successfully");
      setSubject("");
      setMessage("");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message || "Failed to submit support request");
      } else {
        toast.error("Failed to submit support request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Help & Support</h1>
        <p className="text-foreground/60">Get help and find answers to your questions</p>
      </div>

      {/* Quick Help Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6 rounded-3xl border-2 hover:border-primary hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-[#dcfce7] flex items-center justify-center mb-4">
              <Book className="w-6 h-6 text-[#16a34a]" />
            </div>
            <h3 className="font-semibold mb-2">Documentation</h3>
            <p className="text-sm text-foreground/60">Browse our comprehensive guides and tutorials</p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 rounded-3xl border-2 hover:border-primary hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-[#dbeafe] flex items-center justify-center mb-4">
              <Video className="w-6 h-6 text-[#2563eb]" />
            </div>
            <h3 className="font-semibold mb-2">Video Tutorials</h3>
            <p className="text-sm text-foreground/60">Watch step-by-step video guides</p>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6 rounded-3xl border-2 hover:border-primary hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-[#f3e8ff] flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-[#9333ea]" />
            </div>
            <h3 className="font-semibold mb-2">FAQ</h3>
            <p className="text-sm text-foreground/60">Find answers to common questions</p>
          </Card>
        </motion.div>
      </div>

      {/* Contact Support */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Contact Support</h3>
              <p className="text-sm text-foreground/60">
                Can't find what you're looking for? Send us a message and we'll get back to you within 24 hours.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="rounded-xl"
                placeholder="Brief description of your issue"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="rounded-xl"
                rows={6}
                placeholder="Describe your issue or question in detail..."
              />
            </div>

            <Button onClick={handleSubmit} className="rounded-xl" disabled={submitting}>
              {submitting ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Support Channels */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <h3 className="text-lg font-semibold mb-4">Other Ways to Get Help</h3>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-accent/50 rounded-xl">
              <Mail className="w-6 h-6 text-foreground/60" />
              <div className="flex-1">
                <div className="font-medium">Email Support</div>
                <div className="text-sm text-foreground/60">support@finflow.com</div>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-accent/50 rounded-xl">
              <MessageSquare className="w-6 h-6 text-foreground/60" />
              <div className="flex-1">
                <div className="font-medium">Live Chat</div>
                <div className="text-sm text-foreground/60">Available Mon-Fri, 9am-5pm EST</div>
              </div>
              <Button size="sm" variant="outline" className="rounded-xl">
                Start Chat
              </Button>
            </div>

            <div className="flex items-center gap-4 p-4 bg-accent/50 rounded-xl">
              <HelpCircle className="w-6 h-6 text-foreground/60" />
              <div className="flex-1">
                <div className="font-medium">Community Forum</div>
                <div className="text-sm text-foreground/60">Connect with other FinFlow users</div>
              </div>
              <Button size="sm" variant="outline" className="rounded-xl">
                Visit Forum
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Popular Help Topics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <h3 className="text-lg font-semibold mb-4">Popular Help Topics</h3>
          
          <div className="space-y-2">
            {[
              "How to connect a bank account",
              "Setting up budget categories",
              "Understanding AI insights",
              "Managing recurring transactions",
              "Exporting transaction data",
              "Setting financial goals",
              "Using voice commands",
              "Account security best practices",
            ].map((topic, index) => (
              <button
                key={index}
                className="w-full text-left p-3 rounded-xl hover:bg-accent transition-colors text-sm"
              >
                {topic}
              </button>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
