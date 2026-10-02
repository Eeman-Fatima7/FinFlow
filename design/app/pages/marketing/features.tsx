import { motion } from "motion/react";
import { Link } from "react-router";
import { ArrowRight, BarChart3, Brain, MessageSquare, Target, CheckCircle2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { MarketingNav } from "../../components/marketing-nav";
import { MarketingFooter } from "../../components/marketing-footer";

const features = [
  {
    icon: BarChart3,
    name: "Smart Budgeting",
    description: "Set custom budgets for every category and get real-time alerts when you're approaching limits. Our intelligent system learns your spending patterns.",
    href: "/features/smart-budgeting",
    color: "from-[#86efac] to-[#67e8f9]",
    bgColor: "bg-[#dcfce7]"
  },
  {
    icon: Brain,
    name: "AI Insights",
    description: "Get personalized financial advice powered by AI. Discover spending patterns, optimize your budget, and receive proactive recommendations.",
    href: "/features/ai-insights",
    color: "from-[#c084fc] to-[#f9a8d4]",
    bgColor: "bg-[#f3e8ff]"
  },
  {
    icon: MessageSquare,
    name: "Voice Commands",
    description: "Add transactions, check balances, and get insights using natural language. Just speak, and FinFlow understands.",
    href: "/features/voice-commands",
    color: "from-[#67e8f9] to-[#93c5fd]",
    bgColor: "bg-[#cffafe]"
  },
  {
    icon: Target,
    name: "Goal Tracking",
    description: "Set savings goals and watch your progress grow. Get milestone celebrations and smart recommendations to reach your targets faster.",
    href: "/features/goal-tracking",
    color: "from-[#f9a8d4] to-[#93c5fd]",
    bgColor: "bg-[#fce7f3]"
  }
];

const howItWorks = [
  {
    step: "1",
    title: "Connect your accounts",
    description: "Link your bank accounts and credit cards securely. We use bank-level encryption to protect your data."
  },
  {
    step: "2",
    title: "Categorize automatically",
    description: "Our AI automatically categorizes your transactions and identifies spending patterns."
  },
  {
    step: "3",
    title: "Get insights & save",
    description: "Receive personalized recommendations and watch your savings grow with goal tracking."
  }
];

export function Features() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Powerful features for
              <br />
              <span className="bg-gradient-to-r from-[#86efac] via-[#67e8f9] to-[#93c5fd] bg-clip-text text-transparent">
                smart money management
              </span>
            </h1>
            <p className="text-lg text-foreground/70 mb-8">
              Everything you need to take control of your finances, all in one beautiful app
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="bg-primary hover:bg-primary/90 px-8">
                  Start free trial <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/app">
                <Button size="lg" variant="outline" className="px-8">
                  View demo
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Feature cards */}
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <Link to={feature.href}>
                  <Card className="p-8 h-full hover:shadow-xl transition-all duration-300 rounded-3xl border-2 group">
                    <div className={`w-14 h-14 rounded-2xl ${feature.bgColor} flex items-center justify-center mb-6`}>
                      <feature.icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4">{feature.name}</h3>
                    <p className="text-foreground/70 mb-6 leading-relaxed">{feature.description}</p>
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

      {/* How it works */}
      <section className="py-20 md:py-32 bg-white">
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
            <p className="text-lg text-foreground/60 max-w-2xl mx-auto">
              Get started in minutes and take control of your finances
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {howItWorks.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <Card className="p-8 rounded-3xl border-2 h-full">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center mb-6">
                    <span className="text-2xl font-bold text-white">{item.step}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-foreground/70 leading-relaxed">{item.description}</p>
                </Card>
                {index < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-[#67e8f9] to-transparent" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* All features list */}
      <section className="py-20 bg-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Everything included
            </h2>
            <p className="text-lg text-foreground/60">
              Powerful features to help you manage money better
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="p-8 md:p-12 rounded-3xl border-2">
              <div className="grid md:grid-cols-2 gap-x-12 gap-y-6">
                {[
                  "Unlimited transaction tracking",
                  "Custom budget categories",
                  "AI-powered insights",
                  "Voice transaction input",
                  "Savings goal tracking",
                  "Spending trends & analytics",
                  "Bill reminders",
                  "Export reports (CSV, PDF)",
                  "Mobile apps (iOS & Android)",
                  "Real-time notifications",
                  "Bank-level encryption",
                  "Priority customer support"
                ].map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle2 className="w-5 h-5 text-[#16a34a] flex-shrink-0" />
                    <span className="text-foreground/80">{feature}</span>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
        >
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Ready to get started?
          </h2>
          <p className="text-xl text-white/80 mb-10">
            Join 500,000+ people managing their money with FinFlow
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button size="lg" variant="secondary" className="px-8 text-lg rounded-xl">
                Start free trial <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="px-8 text-lg bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl">
                View pricing
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <MarketingFooter />
    </div>
  );
}
