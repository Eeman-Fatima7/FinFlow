import { motion } from "motion/react";
import { Link } from "react-router";
import { ArrowRight, Heart, Users, Target, Zap } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { MarketingNav } from "../../components/marketing-nav";
import { MarketingFooter } from "../../components/marketing-footer";

export function About() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              We're on a mission to make money management
              <span className="bg-gradient-to-r from-[#86efac] via-[#67e8f9] to-[#93c5fd] bg-clip-text text-transparent"> beautifully simple</span>
            </h1>
            <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
              FinFlow was founded in 2024 with a simple belief: managing money shouldn't be stressful. We're building tools that make financial wellness accessible to everyone.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-12 text-center">Our values</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { icon: Heart, title: "People first", description: "We put our users' financial well-being above everything else. Your success is our success." },
              { icon: Users, title: "Inclusive design", description: "Financial tools should work for everyone, regardless of income or background." },
              { icon: Target, title: "Transparency", description: "No hidden fees, no data selling. We're clear about how we make money and what we do with your data." },
              { icon: Zap, title: "Continuous improvement", description: "We ship fast, learn from feedback, and constantly iterate to make FinFlow better." }
            ].map((value, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="p-8 rounded-3xl border-2 h-full">
                  <div className="w-12 h-12 rounded-xl bg-[#dcfce7] flex items-center justify-center mb-4">
                    <value.icon className="w-6 h-6 text-[#16a34a]" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                  <p className="text-foreground/70 leading-relaxed">{value.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-[#fafbfc]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-12 text-center">Our journey</h2>
          <div className="space-y-8">
            {[
              { year: "2024", title: "Founded", description: "FinFlow is born with a mission to simplify personal finance" },
              { year: "2025", title: "50K users", description: "Reached 50,000 active users managing $500M in transactions" },
              { year: "2026", title: "AI Launch", description: "Launched AI-powered insights and voice commands. Now serving 500K+ users" }
            ].map((milestone, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="p-6 rounded-2xl border-2">
                  <div className="flex gap-6">
                    <div className="text-4xl font-bold text-primary">{milestone.year}</div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{milestone.title}</h3>
                      <p className="text-foreground/70">{milestone.description}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team placeholder */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Meet the team</h2>
            <p className="text-foreground/70">We're a small team of designers, engineers, and financial enthusiasts</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { name: "Yahya Khan", role: "CEO & Co-founder" },
              { name: "Eeman Fatima", role: "CTO & Co-founder" },
              { name: "Elena Rodriguez", role: "Head of Design" },
              { name: "Alex Kim", role: "Head of Engineering" }
            ].map((member, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="p-6 rounded-3xl border-2 text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#86efac] to-[#67e8f9] mx-auto mb-4" />
                  <h3 className="font-bold mb-1">{member.name}</h3>
                  <p className="text-sm text-foreground/60">{member.role}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/90 text-white">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Join us on our mission</h2>
          <p className="text-xl text-white/80 mb-8">We're hiring! Check out our open positions</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/careers">
              <Button size="lg" variant="secondary" className="px-8 text-lg rounded-xl">
                View careers <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="lg" variant="outline" className="px-8 text-lg bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl">
                Start free trial
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <MarketingFooter />
    </div>
  );
}
