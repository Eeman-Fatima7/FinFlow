import { motion } from "motion/react";
import { Link } from "@/lib/react-router-shim";
import { ArrowRight, Target, TrendingUp, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

export function FeatureGoalTracking() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 bg-[#dbeafe] px-4 py-2 rounded-full mb-6">
                <Target className="w-4 h-4 text-[#2563eb]" />
                <span className="text-sm font-medium text-[#2563eb]">Goal Tracking</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                Turn dreams into achievable goals
              </h1>
              <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
                Set savings goals, track your progress, and get smart recommendations to reach your targets faster. Every milestone celebrated.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/app/goals">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 px-8">
                    View goals <ArrowRight className="ml-2 w-5 h-5" />
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
                  src="https://images.unsplash.com/photo-1758518731468-98e90ffd7430?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                  alt="Goal tracking"
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
              { icon: Target, title: "Unlimited Goals", description: "Create as many savings goals as you want. Emergency fund, vacation, new car—track them all." },
              { icon: TrendingUp, title: "Visual Progress", description: "Beautiful progress bars and charts show how close you are to each goal." },
              { icon: Calendar, title: "Target Dates", description: "Set target dates and see projected completion based on your current savings rate." },
              { icon: Sparkles, title: "Smart Suggestions", description: "Get AI recommendations on how to reach your goals faster based on your spending." },
              { icon: TrendingUp, title: "Milestone Rewards", description: "Celebrate achievements with milestone notifications when you hit 25%, 50%, 75%, and 100%." },
              { icon: Target, title: "Flexible Contributions", description: "Adjust monthly contributions anytime. We'll automatically recalculate your timeline." }
            ].map((benefit, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                <Card className="p-6 rounded-3xl border-2 h-full hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-[#dbeafe] flex items-center justify-center mb-4">
                    <benefit.icon className="w-6 h-6 text-[#2563eb]" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                  <p className="text-foreground/70 leading-relaxed">{benefit.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular goals */}
      <section className="py-20 bg-[#fafbfc]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-12 text-center">Popular savings goals</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { name: "Emergency Fund", amount: "$8,000", icon: "🛡️" },
              { name: "Dream Vacation", amount: "$6,000", icon: "✈️" },
              { name: "New Car", amount: "$15,000", icon: "🚗" },
              { name: "Home Down Payment", amount: "$50,000", icon: "🏠" },
              { name: "Wedding", amount: "$25,000", icon: "💍" },
              { name: "Education Fund", amount: "$30,000", icon: "🎓" }
            ].map((goal, i) => (
              <Card key={i} className="p-6 rounded-2xl border-2 flex items-center gap-4">
                <div className="text-4xl">{goal.icon}</div>
                <div>
                  <h4 className="font-bold">{goal.name}</h4>
                  <p className="text-sm text-foreground/60">Target: {goal.amount}</p>
                </div>
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
              { name: "Voice Commands", href: "/features/voice-commands", icon: "🎤" }
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
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Start achieving your goals</h2>
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
