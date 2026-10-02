import { motion } from "motion/react";
import { Link } from "react-router";
import { Rocket, Calendar, CheckCircle2, Clock, Sparkles, ArrowRight, Mail } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { MarketingNav } from "../../components/marketing-nav";
import { MarketingFooter } from "../../components/marketing-footer";
import { useState } from "react";

const roadmapItems = {
  now: [
    { title: "AI Budget Optimization", description: "Automatically suggest budget adjustments based on spending patterns", status: "in-progress" },
    { title: "Bill Reminders", description: "Never miss a payment with smart bill notifications", status: "in-progress" },
    { title: "iOS & Android Apps", description: "Native mobile apps with offline support", status: "in-progress" }
  ],
  next: [
    { title: "Investment Tracking", description: "Track stocks, crypto, and retirement accounts in one place", status: "planned" },
    { title: "Shared Budgets", description: "Collaborate on budgets with family members or roommates", status: "planned" },
    { title: "Receipt Scanning", description: "Take photos of receipts and automatically create transactions", status: "planned" },
    { title: "Custom Reports", description: "Build custom financial reports with drag-and-drop", status: "planned" }
  ],
  later: [
    { title: "Tax Preparation", description: "Export tax-ready reports and categorize deductions", status: "researching" },
    { title: "Financial Advisor Chat", description: "Connect with certified financial advisors in-app", status: "researching" },
    { title: "Bill Negotiation", description: "AI-powered service to negotiate better rates on your bills", status: "researching" }
  ]
};

export function Roadmap() {
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-[#dbeafe] px-4 py-2 rounded-full mb-6">
              <Rocket className="w-5 h-5 text-[#2563eb]" />
              <span className="text-sm font-medium text-[#2563eb]">Product Roadmap</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              What's coming to FinFlow
            </h1>
            <p className="text-lg text-foreground/70 mb-8">
              We're constantly improving FinFlow. Here's what we're working on and what's coming next.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Now */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">Now</h2>
                <p className="text-foreground/60">Currently in development</p>
              </div>
            </div>
            <div className="space-y-4">
              {roadmapItems.now.map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold">{item.title}</h3>
                          <span className="px-3 py-1 bg-[#dcfce7] text-[#16a34a] text-xs font-medium rounded-full">
                            In Progress
                          </span>
                        </div>
                        <p className="text-foreground/70">{item.description}</p>
                      </div>
                      <Clock className="w-5 h-5 text-foreground/40 flex-shrink-0" />
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Next */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-16">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#cffafe] flex items-center justify-center">
                <Calendar className="w-6 h-6 text-[#0891b2]" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">Next</h2>
                <p className="text-foreground/60">Coming in the next 3-6 months</p>
              </div>
            </div>
            <div className="space-y-4">
              {roadmapItems.next.map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold">{item.title}</h3>
                          <span className="px-3 py-1 bg-[#cffafe] text-[#0891b2] text-xs font-medium rounded-full">
                            Planned
                          </span>
                        </div>
                        <p className="text-foreground/70">{item.description}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Later */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#f3e8ff] flex items-center justify-center">
                <Rocket className="w-6 h-6 text-[#9333ea]" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">Later</h2>
                <p className="text-foreground/60">On our radar for the future</p>
              </div>
            </div>
            <div className="space-y-4">
              {roadmapItems.later.map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <Card className="p-6 rounded-3xl border-2 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold">{item.title}</h3>
                          <span className="px-3 py-1 bg-[#f3e8ff] text-[#9333ea] text-xs font-medium rounded-full">
                            Researching
                          </span>
                        </div>
                        <p className="text-foreground/70">{item.description}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Email signup */}
      <section className="py-20 bg-[#fafbfc]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <Card className="p-8 md:p-12 rounded-3xl border-2 bg-gradient-to-br from-white to-accent/30">
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Stay in the loop</h3>
                <p className="text-foreground/70">
                  Get notified when we ship new features and updates
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  className="rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button className="rounded-xl whitespace-nowrap">
                  Subscribe
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/90 text-white">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Try FinFlow today</h2>
          <p className="text-xl text-white/80 mb-8">Start with the features we have now—and get excited about what's coming</p>
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
