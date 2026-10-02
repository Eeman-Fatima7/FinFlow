import { motion } from "motion/react";
import { Link } from "react-router";
import { 
  ArrowRight, 
  BarChart3, 
  Brain, 
  Target, 
  TrendingUp, 
  Shield, 
  CheckCircle2,
  Sparkles,
  MessageSquare,
  PiggyBank,
  Menu,
  X
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useState } from "react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { MarketingNav } from "../components/marketing-nav";
import { MarketingFooter } from "../components/marketing-footer";

export function MarketingLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Navigation */}
      <MarketingNav />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#fafbfc] py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
                Your money,
                <br />
                <span className="bg-gradient-to-r from-[#86efac] via-[#67e8f9] to-[#93c5fd] bg-clip-text text-transparent">
                  beautifully simple
                </span>
              </h1>
              <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
                Take control of your finances with AI-powered insights, smart budgeting, 
                and real-time tracking. FinFlow makes managing money feel effortless.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/signup">
                  <Button size="lg" className="bg-primary hover:bg-primary/90 px-8">
                    Start free trial <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="px-8">
                  Watch demo
                </Button>
              </div>
              <div className="flex items-center gap-6 mt-8 text-sm text-foreground/60">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#86efac]" />
                  <span>No credit card</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#86efac]" />
                  <span>14-day trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#86efac]" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#86efac]/20 via-[#67e8f9]/20 to-[#93c5fd]/20 rounded-[2rem] blur-3xl" />
              <Card className="relative p-6 shadow-2xl rounded-3xl bg-white/50 backdrop-blur-sm border-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground/60">Total Balance</span>
                    <span className="text-xs bg-[#dcfce7] text-[#16a34a] px-3 py-1 rounded-full">+12.5%</span>
                  </div>
                  <div className="text-4xl font-bold">$24,847.50</div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="bg-gradient-to-br from-[#dcfce7] to-white p-4 rounded-2xl">
                      <div className="text-xs text-foreground/60 mb-1">Income</div>
                      <div className="text-xl font-bold">$8,400</div>
                    </div>
                    <div className="bg-gradient-to-br from-[#f3e8ff] to-white p-4 rounded-2xl">
                      <div className="text-xs text-foreground/60 mb-1">Expenses</div>
                      <div className="text-xl font-bold">$3,245</div>
                    </div>
                  </div>
                  <div className="pt-4">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-foreground/60">Monthly Budget</span>
                      <span className="font-medium">72%</span>
                    </div>
                    <div className="h-2 bg-accent rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#86efac] to-[#67e8f9] rounded-full" style={{ width: '72%' }} />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pillars Section - 4 Feature Blocks */}
      <section id="features" className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Everything you need to manage money
            </h2>
            <p className="text-lg text-foreground/60 max-w-2xl mx-auto">
              Powerful features designed to give you complete control over your financial life
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            {[
              {
                icon: BarChart3,
                color: "from-[#86efac] to-[#67e8f9]",
                bgColor: "bg-[#dcfce7]",
                title: "Smart Budgeting",
                description: "Set custom budgets for every category and get real-time alerts when you're approaching limits. Our intelligent system learns your spending patterns.",
                image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNpYWwlMjBkYXNoYm9hcmQlMjBhbmFseXRpY3N8ZW58MXx8fHwxNzcxMTA5NTQyfDA&ixlib=rb-4.1.0&q=80&w=1080",
                href: "/features/smart-budgeting"
              },
              {
                icon: Brain,
                color: "from-[#c084fc] to-[#f9a8d4]",
                bgColor: "bg-[#f3e8ff]",
                title: "AI Insights",
                description: "Get personalized financial advice powered by AI. Discover spending patterns, optimize your budget, and receive proactive recommendations.",
                image: "https://images.unsplash.com/photo-1758518727888-ffa196002e59?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHByb2Zlc3Npb25hbCUyMGJ1c2luZXNzfGVufDF8fHx8MTc3MTEwOTU0M3ww&ixlib=rb-4.1.0&q=80&w=1080",
                href: "/features/ai-insights"
              },
              {
                icon: MessageSquare,
                color: "from-[#67e8f9] to-[#93c5fd]",
                bgColor: "bg-[#cffafe]",
                title: "Voice Commands",
                description: "Add transactions, check balances, and get insights using natural language. Just speak, and FinFlow understands.",
                image: "https://images.unsplash.com/photo-1620346438257-595805515344?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW4lMjBlbnRyZXByZW5ldXIlMjBsYXB0b3B8ZW58MXx8fHwxNzcxMTA5NTQzfDA&ixlib=rb-4.1.0&q=80&w=1080",
                href: "/features/voice-commands"
              },
              {
                icon: Target,
                color: "from-[#f9a8d4] to-[#93c5fd]",
                bgColor: "bg-[#fce7f3]",
                title: "Goal Tracking",
                description: "Set savings goals and watch your progress grow. Get milestone celebrations and smart recommendations to reach your targets faster.",
                image: "https://images.unsplash.com/photo-1758518731468-98e90ffd7430?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBidXNpbmVzcyUyMHRlYW0lMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzcxMTA5NTQyfDA&ixlib=rb-4.1.0&q=80&w=1080",
                href: "/features/goal-tracking"
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4 }}
                className="group"
              >
                <Link to={feature.href}>
                  <Card className="p-8 h-full hover:shadow-xl transition-all duration-300 rounded-3xl border-2">
                    <div className={`w-14 h-14 rounded-2xl ${feature.bgColor} flex items-center justify-center mb-6`}>
                      <feature.icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                    <p className="text-foreground/70 mb-6 leading-relaxed">{feature.description}</p>
                    <div className="relative h-48 rounded-2xl overflow-hidden mb-4">
                      <ImageWithFallback 
                        src={feature.image} 
                        alt={feature.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <Button variant="ghost" className="group/btn p-0 h-auto hover:bg-transparent">
                      Learn more 
                      <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section id="security" className="py-20 bg-gradient-to-br from-[#dcfce7] via-[#cffafe] to-[#dbeafe]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-white/50 backdrop-blur-sm px-6 py-3 rounded-full mb-8">
              <Shield className="w-5 h-5 text-[#16a34a]" />
              <span className="font-medium">Bank-level security</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Trusted by <span className="bg-gradient-to-r from-[#16a34a] to-[#0891b2] bg-clip-text text-transparent">500,000+</span> people
            </h2>
            <p className="text-lg text-foreground/70 max-w-2xl mx-auto mb-12">
              Your data is encrypted and protected with 256-bit SSL. We never sell your information.
            </p>

            {/* Logo strip */}
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 opacity-60">
              {["Stripe", "Plaid", "Visa", "Mastercard", "AWS"].map((company) => (
                <div key={company} className="text-xl font-bold text-foreground/40">
                  {company}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Story Cards Section */}
      <section className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Real people, real results
            </h2>
            <p className="text-lg text-foreground/60 max-w-2xl mx-auto">
              See how FinFlow helps people take control of their finances
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                problem: "Overspending",
                result: "Saved $12K in 6 months",
                quote: "I finally understand where my money goes. The AI insights helped me cut unnecessary expenses.",
                name: "Sarah Chen",
                role: "Product Designer",
                savings: "+$12,000"
              },
              {
                problem: "No emergency fund",
                result: "Built $15K savings",
                quote: "The goal tracking feature kept me motivated. Hit my emergency fund target faster than expected.",
                name: "Marcus Johnson",
                role: "Software Engineer",
                savings: "+$15,000"
              },
              {
                problem: "Budget confusion",
                result: "Crystal clear finances",
                quote: "Voice input makes tracking so easy. I just tell FinFlow what I spent and it handles everything.",
                name: "Elena Rodriguez",
                role: "Teacher",
                savings: "100% clarity"
              }
            ].map((story, index) => (
              <motion.div
                key={story.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <Card className="p-8 h-full hover:shadow-xl transition-all duration-300 rounded-3xl border-2">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="px-3 py-1 bg-red-50 text-red-600 text-xs rounded-full">
                      Problem
                    </div>
                    <span className="text-sm text-foreground/60">{story.problem}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="px-3 py-1 bg-[#dcfce7] text-[#16a34a] text-xs rounded-full">
                      Result
                    </div>
                    <span className="text-sm font-medium">{story.result}</span>
                  </div>
                  <p className="text-foreground/70 mb-6 italic leading-relaxed">
                    "{story.quote}"
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <div className="font-medium">{story.name}</div>
                      <div className="text-sm text-foreground/60">{story.role}</div>
                    </div>
                    <div className="text-2xl font-bold text-[#16a34a]">
                      {story.savings}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Spotlight/Resources Section */}
      <section id="resources" className="py-20 md:py-32 bg-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Financial wisdom, delivered
            </h2>
            <p className="text-lg text-foreground/60 max-w-2xl mx-auto">
              Tips, guides, and updates to help you master your money
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                tag: "Guide",
                title: "The 50/30/20 Budget Rule",
                description: "Learn the simple framework used by millions to balance spending, saving, and financial freedom.",
                icon: PiggyBank,
                color: "from-[#86efac] to-[#67e8f9]"
              },
              {
                tag: "Tips",
                title: "10 Ways to Cut Monthly Expenses",
                description: "Practical strategies to reduce spending without sacrificing your lifestyle.",
                icon: TrendingUp,
                color: "from-[#c084fc] to-[#f9a8d4]"
              },
              {
                tag: "Update",
                title: "New: AI Budget Assistant",
                description: "Our latest feature uses machine learning to optimize your spending in real-time.",
                icon: Sparkles,
                color: "from-[#67e8f9] to-[#93c5fd]"
              }
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4 }}
                className="group cursor-pointer"
              >
                <Card className="p-8 h-full hover:shadow-xl transition-all duration-300 rounded-3xl border-2">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-6`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-xs text-foreground/60 uppercase tracking-wider mb-2">
                    {item.tag}
                  </div>
                  <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-foreground/70 leading-relaxed mb-4">
                    {item.description}
                  </p>
                  <Button variant="ghost" className="group/btn p-0 h-auto hover:bg-transparent text-primary">
                    Read more 
                    <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA section + footer */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(134,239,172,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(103,232,249,0.1),transparent_50%)]" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10"
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Start your financial journey today
          </h2>
          <p className="text-xl text-white/80 mb-10 leading-relaxed">
            Join thousands who have transformed their relationship with money. 
            No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button size="lg" variant="secondary" className="px-8 text-lg rounded-xl">
                Get started free <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="px-8 text-lg bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl">
              Talk to sales
            </Button>
          </div>
          <p className="text-sm text-white/60 mt-6">
            14-day free trial • No credit card required • Cancel anytime
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <MarketingFooter />
    </div>
  );
}