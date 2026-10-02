import { motion } from "motion/react";
import { Link } from "@/lib/react-router-shim";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

export function Compliance() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-4 gap-12">
            <div className="lg:col-span-1">
              <Link to="/">
                <Button variant="ghost" className="mb-8 p-0 h-auto">
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  Back to home
                </Button>
              </Link>
              <nav className="space-y-2 sticky top-20">
                <a href="#overview" className="block text-sm text-foreground/70 hover:text-primary py-2">Overview</a>
                <a href="#soc2" className="block text-sm text-foreground/70 hover:text-primary py-2">SOC 2</a>
                <a href="#gdpr" className="block text-sm text-foreground/70 hover:text-primary py-2">GDPR</a>
                <a href="#ccpa" className="block text-sm text-foreground/70 hover:text-primary py-2">CCPA</a>
                <a href="#pci" className="block text-sm text-foreground/70 hover:text-primary py-2">PCI DSS</a>
              </nav>
            </div>

            <div className="lg:col-span-3">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="inline-flex items-center gap-2 bg-[#dbeafe] px-4 py-2 rounded-full mb-6">
                  <CheckCircle2 className="w-4 h-4 text-[#2563eb]" />
                  <span className="text-sm font-medium text-[#2563eb]">Compliance</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold mb-4">Security & Compliance</h1>
                <p className="text-foreground/60 mb-8">Last updated: February 15, 2026</p>

                <div className="prose prose-lg max-w-none">
                  <section id="overview" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">Overview</h2>
                    <p className="text-foreground/70 leading-relaxed mb-6">
                      FinFlow is committed to maintaining the highest standards of security and compliance. We undergo regular audits and certifications to ensure we meet industry requirements.
                    </p>
                  </section>

                  <section id="soc2" className="mb-12">
                    <Card className="p-8 rounded-3xl border-2">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-[#dcfce7] flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-6 h-6 text-[#16a34a]" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold mb-2">SOC 2 Type II</h3>
                          <p className="text-foreground/70 leading-relaxed">
                            We are SOC 2 Type II certified, demonstrating our commitment to security, availability, and confidentiality. Our systems are audited annually by independent third parties.
                          </p>
                        </div>
                      </div>
                    </Card>
                  </section>

                  <section id="gdpr" className="mb-12">
                    <Card className="p-8 rounded-3xl border-2">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-[#cffafe] flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-6 h-6 text-[#0891b2]" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold mb-2">GDPR Compliant</h3>
                          <p className="text-foreground/70 leading-relaxed mb-4">
                            We comply with the General Data Protection Regulation (GDPR) for all European users. You have the right to:
                          </p>
                          <ul className="space-y-2 text-foreground/70">
                            <li>• Access your personal data</li>
                            <li>• Request data deletion</li>
                            <li>• Data portability</li>
                            <li>• Withdraw consent at any time</li>
                          </ul>
                        </div>
                      </div>
                    </Card>
                  </section>

                  <section id="ccpa" className="mb-12">
                    <Card className="p-8 rounded-3xl border-2">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-6 h-6 text-[#2563eb]" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold mb-2">CCPA Compliant</h3>
                          <p className="text-foreground/70 leading-relaxed">
                            We comply with the California Consumer Privacy Act (CCPA). California residents have additional rights regarding their personal information, including the right to know what data we collect and the right to opt-out of data sales (note: we do not sell personal data).
                          </p>
                        </div>
                      </div>
                    </Card>
                  </section>

                  <section id="pci" className="mb-12">
                    <Card className="p-8 rounded-3xl border-2">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-[#f3e8ff] flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-6 h-6 text-[#9333ea]" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold mb-2">PCI DSS</h3>
                          <p className="text-foreground/70 leading-relaxed">
                            We use Stripe for payment processing, which is PCI DSS Level 1 certified. We do not store credit card information on our servers.
                          </p>
                        </div>
                      </div>
                    </Card>
                  </section>

                  <section className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">Questions?</h2>
                    <p className="text-foreground/70 leading-relaxed">
                      For compliance inquiries, contact our security team at compliance@finflow.com
                    </p>
                  </section>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}
