import { motion } from "motion/react";
import { Link } from "@/lib/react-router-shim";
import { Check, ArrowRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const plans = [
  {
    name: "Free",
    price: { monthly: 0, yearly: 0 },
    description: "Perfect for getting started with budgeting",
    features: [
      "Up to 100 transactions/month",
      "Basic budget tracking",
      "Manual transaction entry",
      "Mobile app access",
      "Email support"
    ],
    cta: "Start free",
    highlighted: false
  },
  {
    name: "Pro",
    price: { monthly: 12, yearly: 120 },
    description: "For serious budgeters and savers",
    features: [
      "Unlimited transactions",
      "AI-powered insights",
      "Voice input",
      "Automatic categorization",
      "Goal tracking (unlimited)",
      "Custom budgets",
      "Priority support",
      "Export reports"
    ],
    cta: "Start 14-day trial",
    highlighted: true
  },
  {
    name: "Team",
    price: { monthly: 29, yearly: 290 },
    description: "Collaborate on household finances",
    features: [
      "Everything in Pro",
      "Up to 5 team members",
      "Shared budgets & goals",
      "Real-time sync",
      "Advanced permissions",
      "Family reports",
      "Dedicated support",
      "Custom integrations"
    ],
    cta: "Start 14-day trial",
    highlighted: false
  }
];

const faqs = [
  {
    question: "Can I switch plans at any time?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any charges or credits."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards (Visa, Mastercard, American Express, Discover) and PayPal. All payments are processed securely through Stripe."
  },
  {
    question: "Is there a free trial?",
    answer: "Yes! Pro and Team plans come with a 14-day free trial. No credit card required. The Free plan is always free with no trial needed."
  },
  {
    question: "Can I cancel anytime?",
    answer: "Absolutely. You can cancel your subscription at any time from your account settings. You'll continue to have access until the end of your billing period."
  },
  {
    question: "Do you offer student or nonprofit discounts?",
    answer: "Yes! We offer 50% off Pro plans for students and nonprofits. Contact our support team with proof of eligibility to get your discount code."
  },
  {
    question: "What happens to my data if I cancel?",
    answer: "Your data is always yours. If you cancel, you can export all your data at any time. We keep your data for 90 days after cancellation in case you want to reactivate."
  }
];

export function Pricing() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto mb-12"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Simple pricing for everyone
            </h1>
            <p className="text-lg text-foreground/70 mb-8">
              Start free, upgrade when you need more. All plans include 14-day free trial.
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-3 p-1 bg-accent rounded-2xl">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-white shadow-sm'
                    : 'text-foreground/60'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('yearly')}
                className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
                  billingPeriod === 'yearly'
                    ? 'bg-white shadow-sm'
                    : 'text-foreground/60'
                }`}
              >
                Yearly
                <span className="ml-2 text-xs bg-[#dcfce7] text-[#16a34a] px-2 py-1 rounded-full">
                  Save 17%
                </span>
              </button>
            </div>
          </motion.div>

          {/* Plans */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`p-8 rounded-3xl h-full flex flex-col ${
                  plan.highlighted
                    ? 'border-4 border-primary shadow-2xl relative'
                    : 'border-2'
                }`}>
                  {plan.highlighted && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#86efac] to-[#67e8f9] text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </div>
                  )}
                  
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                    <p className="text-sm text-foreground/60 mb-6">{plan.description}</p>
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-bold">
                        ${billingPeriod === 'monthly' ? plan.price.monthly : plan.price.yearly}
                      </span>
                      <span className="text-foreground/60 mb-2">
                        /{billingPeriod === 'yearly' ? 'year' : 'month'}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-[#16a34a] flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to="/signup">
                    <Button 
                      className={`w-full rounded-xl ${
                        plan.highlighted
                          ? 'bg-primary hover:bg-primary/90'
                          : ''
                      }`}
                      variant={plan.highlighted ? 'default' : 'outline'}
                    >
                      {plan.cta}
                      {plan.highlighted && <ArrowRight className="ml-2 w-4 h-4" />}
                    </Button>
                  </Link>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Enterprise */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 max-w-6xl mx-auto"
          >
            <Card className="p-8 rounded-3xl border-2 bg-gradient-to-br from-[#fafbfc] to-white">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
                  <p className="text-foreground/70">
                    Custom solutions for large organizations. Volume discounts, dedicated support, and advanced security.
                  </p>
                </div>
                <Button size="lg" variant="outline" className="rounded-xl px-8 whitespace-nowrap">
                  Contact Sales
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Feature comparison */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Compare plans
            </h2>
            <p className="text-lg text-foreground/60">
              Find the perfect plan for your needs
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="hidden md:block"
          >
            <Card className="p-8 rounded-3xl border-2 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-4 font-medium">Feature</th>
                    <th className="text-center py-4 font-medium">Free</th>
                    <th className="text-center py-4 font-medium">Pro</th>
                    <th className="text-center py-4 font-medium">Team</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: "Transaction tracking", free: "100/mo", pro: "Unlimited", team: "Unlimited" },
                    { feature: "AI insights", free: false, pro: true, team: true },
                    { feature: "Voice input", free: false, pro: true, team: true },
                    { feature: "Goal tracking", free: "3 goals", pro: "Unlimited", team: "Unlimited" },
                    { feature: "Custom budgets", free: false, pro: true, team: true },
                    { feature: "Team members", free: "1", pro: "1", team: "5" },
                    { feature: "Export reports", free: false, pro: true, team: true },
                    { feature: "Priority support", free: false, pro: true, team: true },
                  ].map((row, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-4 text-sm">{row.feature}</td>
                      <td className="text-center py-4">
                        {typeof row.free === 'boolean' ? (
                          row.free ? <Check className="w-5 h-5 text-[#16a34a] mx-auto" /> : <span className="text-foreground/30">—</span>
                        ) : (
                          <span className="text-sm">{row.free}</span>
                        )}
                      </td>
                      <td className="text-center py-4">
                        {typeof row.pro === 'boolean' ? (
                          row.pro ? <Check className="w-5 h-5 text-[#16a34a] mx-auto" /> : <span className="text-foreground/30">—</span>
                        ) : (
                          <span className="text-sm">{row.pro}</span>
                        )}
                      </td>
                      <td className="text-center py-4">
                        {typeof row.team === 'boolean' ? (
                          row.team ? <Check className="w-5 h-5 text-[#16a34a] mx-auto" /> : <span className="text-foreground/30">—</span>
                        ) : (
                          <span className="text-sm">{row.team}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-[#fafbfc]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Frequently asked questions
            </h2>
            <p className="text-lg text-foreground/60">
              Everything you need to know about our pricing
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="p-8 rounded-3xl border-2">
              <Accordion type="single" collapsible>
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      <div className="flex items-start gap-3">
                        <HelpCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{faq.question}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-foreground/70 pl-8">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
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
            Ready to take control?
          </h2>
          <p className="text-xl text-white/80 mb-10">
            Start your 14-day free trial. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button size="lg" variant="secondary" className="px-8 text-lg rounded-xl">
                Start free trial <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="/signin">
              <Button size="lg" variant="outline" className="px-8 text-lg bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl">
                Sign in
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <MarketingFooter />
    </div>
  );
}
