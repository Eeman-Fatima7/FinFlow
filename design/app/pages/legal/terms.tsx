import { motion } from "motion/react";
import { Link } from "react-router";
import { FileText, ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import { MarketingNav } from "../../components/marketing-nav";
import { MarketingFooter } from "../../components/marketing-footer";

export function Terms() {
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
                <a href="#acceptance" className="block text-sm text-foreground/70 hover:text-primary py-2">Acceptance of Terms</a>
                <a href="#services" className="block text-sm text-foreground/70 hover:text-primary py-2">Use of Services</a>
                <a href="#accounts" className="block text-sm text-foreground/70 hover:text-primary py-2">User Accounts</a>
                <a href="#prohibited" className="block text-sm text-foreground/70 hover:text-primary py-2">Prohibited Conduct</a>
                <a href="#termination" className="block text-sm text-foreground/70 hover:text-primary py-2">Termination</a>
                <a href="#limitation" className="block text-sm text-foreground/70 hover:text-primary py-2">Limitation of Liability</a>
              </nav>
            </div>

            <div className="lg:col-span-3">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="inline-flex items-center gap-2 bg-[#cffafe] px-4 py-2 rounded-full mb-6">
                  <FileText className="w-4 h-4 text-[#0891b2]" />
                  <span className="text-sm font-medium text-[#0891b2]">Legal</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
                <p className="text-foreground/60 mb-8">Last updated: February 15, 2026</p>

                <div className="prose prose-lg max-w-none">
                  <section id="acceptance" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
                    <p className="text-foreground/70 leading-relaxed mb-4">
                      By accessing or using FinFlow, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
                    </p>
                  </section>

                  <section id="services" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">2. Use of Services</h2>
                    <p className="text-foreground/70 leading-relaxed mb-4">
                      FinFlow provides personal finance management tools. You may use our services only for lawful purposes and in accordance with these Terms.
                    </p>
                  </section>

                  <section id="accounts" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">3. User Accounts</h2>
                    <p className="text-foreground/70 leading-relaxed mb-4">
                      You are responsible for:
                    </p>
                    <ul className="space-y-2 text-foreground/70 mb-6">
                      <li>• Maintaining the confidentiality of your account credentials</li>
                      <li>• All activities that occur under your account</li>
                      <li>• Notifying us immediately of any unauthorized access</li>
                    </ul>
                  </section>

                  <section id="prohibited" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">4. Prohibited Conduct</h2>
                    <p className="text-foreground/70 leading-relaxed mb-4">
                      You may not:
                    </p>
                    <ul className="space-y-2 text-foreground/70 mb-6">
                      <li>• Violate any laws or regulations</li>
                      <li>• Infringe on intellectual property rights</li>
                      <li>• Transmit viruses or malicious code</li>
                      <li>• Attempt to gain unauthorized access to our systems</li>
                      <li>• Use our services for fraudulent purposes</li>
                    </ul>
                  </section>

                  <section id="termination" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">5. Termination</h2>
                    <p className="text-foreground/70 leading-relaxed mb-4">
                      We may terminate or suspend your account at any time for violations of these Terms. You may cancel your account at any time from your account settings.
                    </p>
                  </section>

                  <section id="limitation" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">6. Limitation of Liability</h2>
                    <p className="text-foreground/70 leading-relaxed mb-4">
                      FinFlow provides its services "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of our services.
                    </p>
                  </section>

                  <section className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">Contact</h2>
                    <p className="text-foreground/70 leading-relaxed">
                      Questions about these Terms? Contact us at legal@finflow.com
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
