import { motion } from "motion/react";
import { Link } from "react-router";
import { ArrowRight, BarChart3, Bell, TrendingUp, PieChart, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { MarketingNav } from "../../components/marketing-nav";
import { MarketingFooter } from "../../components/marketing-footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";

export function FeatureSmartBudgeting() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="inline-flex items-center gap-2 bg-[#dcfce7] px-4 py-2 rounded-full mb-6">
                <BarChart3 className="w-4 h-4 text-[#16a34a]" />
                <span className="text-sm font-medium text-[#16a34a]">Smart Budgeting</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
                Budget smarter, not harder
              </h1>
              <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
                Set custom budgets for every category, get real-time alerts, and watch your spending patterns with intelligent insights that help you save more.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/app/budget">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 px-8">
                    Try in app <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="lg" variant="outline" className="px-8">
                    Start free trial
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <Card className="p-6 rounded-3xl border-2 bg-white shadow-2xl">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
                  alt="Budget dashboard"
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Everything you need to budget effectively
            </h2>
            <p className="text-lg text-foreground/60 max-w-2xl mx-auto">
              Powerful tools that make budgeting simple and effective
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: PieChart,
                title: "Custom Categories",
                description: "Create unlimited budget categories tailored to your lifestyle. Housing, groceries, entertainment—track it all your way."
              },
              {
                icon: Bell,
                title: "Smart Alerts",
                description: "Get notified when you're approaching budget limits. Stay in control before overspending happens."
              },
              {
                icon: TrendingUp,
                title: "Spending Insights",
                description: "See where your money goes with beautiful charts and trends. Understand your patterns and optimize spending."
              },
              {
                icon: Sparkles,
                title: "AI Recommendations",
                description: "Get personalized suggestions to improve your budget based on your spending history and goals."
              },
              {
                icon: CheckCircle2,
                title: "Progress Tracking",
                description: "Visual progress bars show how much budget remains in each category at a glance."
              },
              {
                icon: BarChart3,
                title: "Monthly Reports",
                description: "Detailed breakdown of spending vs. budget with insights to help you save more next month."
              }
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-6 rounded-3xl border-2 h-full hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-[#dcfce7] flex items-center justify-center mb-4">
                    <benefit.icon className="w-6 h-6 text-[#16a34a]" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                  <p className="text-foreground/70 leading-relaxed">{benefit.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              How it works
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              { step: "1", title: "Set budgets", desc: "Choose categories and set monthly limits" },
              { step: "2", title: "Track spending", desc: "Transactions auto-categorize as you spend" },
              { step: "3", title: "Get alerts", desc: "Receive notifications before overspending" },
              { step: "4", title: "Adjust & save", desc: "Refine budgets and watch savings grow" }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-6 rounded-3xl border-2 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-white">{item.step}</span>
                  </div>
                  <h3 className="font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-foreground/70">{item.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12"
          >
            <h2 className="text-3xl font-bold mb-4 text-center">Frequently asked questions</h2>
          </motion.div>

          <Card className="p-8 rounded-3xl border-2">
            <Accordion type="single" collapsible>
              {[
                {
                  q: "Can I create custom budget categories?",
                  a: "Yes! Create unlimited custom categories that match your lifestyle. You can also use our pre-made categories like Housing, Food, Transportation, and more."
                },
                {
                  q: "How do budget alerts work?",
                  a: "You'll receive notifications when you've spent 75%, 90%, and 100% of your budget in any category. You can customize these thresholds in settings."
                },
                {
                  q: "Can I adjust budgets mid-month?",
                  a: "Absolutely. You can modify budget limits anytime. Changes take effect immediately and we'll recalculate your remaining budget."
                }
              ].map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger>{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-foreground/70">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </div>
      </section>

      {/* Related features */}
      <section className="py-20 bg-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold mb-8 text-center">Explore more features</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "AI Insights", href: "/features/ai-insights", icon: "🧠" },
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto px-4 text-center"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Start budgeting smarter today
          </h2>
          <p className="text-xl text-white/80 mb-8">
            Join 500,000+ people who have transformed their spending habits
          </p>
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
