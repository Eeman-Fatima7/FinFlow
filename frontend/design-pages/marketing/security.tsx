import { motion } from "motion/react";
import { Link } from "@/lib/react-router-shim";
import { Shield, Lock, Eye, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function Security() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-[#dcfce7] px-4 py-2 rounded-full mb-6">
              <Shield className="w-5 h-5 text-[#16a34a]" />
              <span className="text-sm font-medium text-[#16a34a]">Bank-level security</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Your data is safe with us
            </h1>
            <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
              We use bank-level encryption and industry-leading security practices to protect your financial data. Your privacy is our top priority.
            </p>
          </motion.div>

          {/* Security stats */}
          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto mt-16">
            {[
              { number: "256-bit", label: "SSL encryption" },
              { number: "100%", label: "SOC 2 compliant" },
              { number: "24/7", label: "Security monitoring" },
              { number: "0", label: "Data breaches" }
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="p-6 rounded-3xl border-2 text-center">
                  <div className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#16a34a] to-[#0891b2] bg-clip-text text-transparent">
                    {stat.number}
                  </div>
                  <div className="text-sm text-foreground/60">{stat.label}</div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security features */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: Lock,
                title: "Bank-grade encryption",
                description: "All data is encrypted in transit and at rest using 256-bit SSL encryption—the same security used by major banks.",
                features: ["End-to-end encryption", "Secure data centers", "Encrypted backups"]
              },
              {
                icon: Eye,
                title: "Read-only access",
                description: "We can only view your transactions. We cannot move money or make purchases on your behalf.",
                features: ["Read-only bank connections", "No fund transfers", "Multi-factor authentication"]
              },
              {
                icon: Shield,
                title: "Privacy protection",
                description: "We never sell your data. Your financial information is yours and yours alone.",
                features: ["No data selling", "GDPR compliant", "Anonymous analytics only"]
              },
              {
                icon: CheckCircle2,
                title: "Regular audits",
                description: "Independent security audits and penetration testing ensure our systems stay secure.",
                features: ["Annual security audits", "SOC 2 Type II certified", "Bug bounty program"]
              }
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="p-8 rounded-3xl border-2 h-full">
                  <div className="w-14 h-14 rounded-2xl bg-[#dcfce7] flex items-center justify-center mb-6">
                    <item.icon className="w-7 h-7 text-[#16a34a]" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                  <p className="text-foreground/70 mb-6 leading-relaxed">{item.description}</p>
                  <ul className="space-y-2">
                    {item.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 bg-[#fafbfc]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-12 text-center">Security FAQs</h2>
          <Card className="p-8 rounded-3xl border-2">
            <Accordion type="single" collapsible>
              {[
                {
                  q: "How do you protect my bank login credentials?",
                  a: "We use Plaid to connect to your bank accounts. Plaid uses bank-level 256-bit encryption and never stores your credentials. We never see your bank username or password."
                },
                {
                  q: "Can you move money from my accounts?",
                  a: "No. FinFlow has read-only access to your accounts. We can only view transactions and balances—we cannot transfer money or make purchases."
                },
                {
                  q: "Do you sell my data to third parties?",
                  a: "Never. We do not sell, rent, or share your personal financial data with anyone. Your data belongs to you."
                },
                {
                  q: "What happens if there's a security breach?",
                  a: "While we've never had a breach, we have protocols in place to notify affected users within 72 hours and provide credit monitoring services if needed."
                },
                {
                  q: "How can I delete my data?",
                  a: "You can request full data deletion from your account settings. All data is permanently deleted within 30 days of your request."
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

      {/* Trust badges */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl font-bold mb-8">Trusted security partners</h3>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
            {["Plaid", "Stripe", "AWS", "SOC 2", "GDPR"].map((partner) => (
              <div key={partner} className="text-xl font-bold text-foreground/40">{partner}</div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/90 text-white">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Your security is our priority</h2>
          <p className="text-xl text-white/80 mb-8">Join 500,000+ people who trust FinFlow with their financial data</p>
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
