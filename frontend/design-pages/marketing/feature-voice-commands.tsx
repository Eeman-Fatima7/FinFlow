import { motion } from "motion/react";
import { Link } from "@/lib/react-router-shim";
import { ArrowRight, Mic, Zap, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

export function FeatureVoiceCommands() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 bg-[#cffafe] px-4 py-2 rounded-full mb-6">
                <Mic className="w-4 h-4 text-[#0891b2]" />
                <span className="text-sm font-medium text-[#0891b2]">Voice Commands</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                Manage money with your voice
              </h1>
              <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
                Add transactions, check balances, and get insights using natural language. Just speak, and FinFlow understands.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/app/voice">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 px-8">
                    Try voice input <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="lg" variant="outline" className="px-8">Start free trial</Button>
                </Link>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
              <Card className="p-6 rounded-3xl border-2 bg-white shadow-2xl">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1620346438257-595805515344?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                  alt="Voice input"
                  className="w-full rounded-2xl"
                />
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Lightning Fast", description: "Add transactions in seconds. No typing, no forms—just speak naturally." },
              { icon: Clock, title: "Save Time", description: "10x faster than manual entry. Perfect for logging expenses on the go." },
              { icon: Shield, title: "Accurate & Smart", description: "AI understands context and automatically categorizes your transactions." },
              { icon: Mic, title: "Natural Language", description: "Say it your way: \"I spent $45 at Starbucks\" or \"Add $45 coffee expense\"—both work!" },
              { icon: Zap, title: "Hands-Free", description: "Perfect for when you're driving, cooking, or your hands are full." },
              { icon: Shield, title: "Private & Secure", description: "Voice processing happens on-device. Your words stay private." }
            ].map((benefit, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                <Card className="p-6 rounded-3xl border-2 h-full hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-[#cffafe] flex items-center justify-center mb-4">
                    <benefit.icon className="w-6 h-6 text-[#0891b2]" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                  <p className="text-foreground/70 leading-relaxed">{benefit.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Example commands */}
      <section className="py-20 bg-[#fafbfc]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-12 text-center">Try these commands</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              "I spent $45 at Starbucks",
              "Add $150 grocery expense",
              "Record $3,200 salary payment",
              "I bought coffee for $8.50",
              "$120 for electric bill",
              "Paid $89 for gas"
            ].map((command, i) => (
              <Card key={i} className="p-4 rounded-2xl border-2">
                <p className="text-foreground/70">"{command}"</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Related features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold mb-8 text-center">Explore more features</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Smart Budgeting", href: "/features/smart-budgeting", icon: "📊" },
              { name: "AI Insights", href: "/features/ai-insights", icon: "🧠" },
              { name: "Goal Tracking", href: "/features/goal-tracking", icon: "🎯" }
            ].map((feature) => (
              <Link key={feature.name} to={feature.href}>
                <Card className="p-6 rounded-2xl border-2 hover:shadow-lg transition-all text-center">
                  <div className="text-4xl mb-3">{feature.icon}</div>
                  <h4 className="font-bold">{feature.name}</h4>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/90 text-white">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Start using voice commands</h2>
          <Link to="/signup">
            <Button size="lg" variant="secondary" className="px-8 text-lg rounded-xl">
              Start free trial <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </motion.div>
      </section>

      <MarketingFooter />
    </div>
  );
}
