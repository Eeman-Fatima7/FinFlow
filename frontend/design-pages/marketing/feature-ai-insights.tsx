import { motion } from "motion/react";
import { Link } from "@/lib/react-router-shim";
import { ArrowRight, Brain, Sparkles, TrendingUp, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

export function FeatureAIInsights() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 bg-[#f3e8ff] px-4 py-2 rounded-full mb-6">
                <Brain className="w-4 h-4 text-[#9333ea]" />
                <span className="text-sm font-medium text-[#9333ea]">AI Insights</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                Your personal financial advisor, powered by AI
              </h1>
              <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
                Get personalized recommendations, discover spending patterns, and receive proactive advice to optimize your finances—all powered by advanced AI.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/app/chat">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 px-8">
                    Try AI Chat <ArrowRight className="ml-2 w-5 h-5" />
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
                  src="https://images.unsplash.com/photo-1758518727888-ffa196002e59?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                  alt="AI Chat interface"
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
              { icon: Brain, title: "Smart Analysis", description: "AI analyzes your spending patterns and identifies opportunities to save money automatically." },
              { icon: MessageSquare, title: "Natural Conversations", description: "Ask questions in plain English and get instant, personalized financial advice." },
              { icon: TrendingUp, title: "Predictive Insights", description: "See forecasts of future spending and get alerts about upcoming bills or budget concerns." },
              { icon: Sparkles, title: "Custom Recommendations", description: "Receive tailored suggestions based on your unique financial situation and goals." },
              { icon: Brain, title: "Category Detection", description: "Automatically categorizes transactions with 95% accuracy using machine learning." },
              { icon: TrendingUp, title: "Trend Analysis", description: "Spot spending trends before they become problems with weekly summaries." }
            ].map((benefit, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                <Card className="p-6 rounded-3xl border-2 h-full hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-[#f3e8ff] flex items-center justify-center mb-4">
                    <benefit.icon className="w-6 h-6 text-[#9333ea]" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                  <p className="text-foreground/70 leading-relaxed">{benefit.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Related features */}
      <section className="py-20 bg-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold mb-8 text-center">Explore more features</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Smart Budgeting", href: "/features/smart-budgeting", icon: "📊" },
              { name: "Voice Commands", href: "/features/voice-commands", icon: "🎤" },
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
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Get AI-powered financial advice</h2>
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
