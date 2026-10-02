import { motion } from "motion/react";
import { Link } from "@/lib/react-router-shim";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

export function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-4 gap-12">
            {/* Sidebar nav */}
            <div className="lg:col-span-1">
              <Link to="/">
                <Button variant="ghost" className="mb-8 p-0 h-auto">
                  <ArrowLeft className="mr-2 w-4 h-4" />
                  Back to home
                </Button>
              </Link>
              <nav className="space-y-2 sticky top-20">
                <a href="#collection" className="block text-sm text-foreground/70 hover:text-primary py-2">Information Collection</a>
                <a href="#usage" className="block text-sm text-foreground/70 hover:text-primary py-2">How We Use Data</a>
                <a href="#sharing" className="block text-sm text-foreground/70 hover:text-primary py-2">Data Sharing</a>
                <a href="#security" className="block text-sm text-foreground/70 hover:text-primary py-2">Security</a>
                <a href="#rights" className="block text-sm text-foreground/70 hover:text-primary py-2">Your Rights</a>
                <a href="#contact" className="block text-sm text-foreground/70 hover:text-primary py-2">Contact Us</a>
              </nav>
            </div>

            {/* Content */}
            <div className="lg:col-span-3">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="inline-flex items-center gap-2 bg-[#dcfce7] px-4 py-2 rounded-full mb-6">
                  <Shield className="w-4 h-4 text-[#16a34a]" />
                  <span className="text-sm font-medium text-[#16a34a]">Legal</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
                <p className="text-foreground/60 mb-8">Last updated: February 15, 2026</p>

                <div className="prose prose-lg max-w-none">
                  <section id="collection" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">Information We Collect</h2>
                    <p className="text-foreground/70 leading-relaxed mb-4">
                      We collect information that you provide directly to us when you create an account, use our services, or communicate with us. This includes:
                    </p>
                    <ul className="space-y-2 text-foreground/70 mb-6">
                      <li>• Account information (name, email, password)</li>
                      <li>• Financial data (transactions, account balances) via secure third-party connections</li>
                      <li>• Usage data (how you interact with our app)</li>
                      <li>• Device information (browser type, IP address)</li>
                    </ul>
                  </section>

                  <section id="usage" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">How We Use Your Data</h2>
                    <p className="text-foreground/70 leading-relaxed mb-4">
                      We use the information we collect to:
                    </p>
                    <ul className="space-y-2 text-foreground/70 mb-6">
                      <li>• Provide, maintain, and improve our services</li>
                      <li>• Generate personalized insights and recommendations</li>
                      <li>• Send you notifications about your account</li>
                      <li>• Detect and prevent fraud or security issues</li>
                      <li>• Comply with legal obligations</li>
                    </ul>
                  </section>

                  <section id="sharing" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">Data Sharing</h2>
                    <p className="text-foreground/70 leading-relaxed mb-4">
                      We do not sell your personal or financial data. We may share data with:
                    </p>
                    <ul className="space-y-2 text-foreground/70 mb-6">
                      <li>• Service providers who help us operate our platform (e.g., Plaid for bank connections)</li>
                      <li>• Law enforcement when required by law</li>
                      <li>• Business partners with your explicit consent</li>
                    </ul>
                  </section>

                  <section id="security" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">Security</h2>
                    <p className="text-foreground/70 leading-relaxed mb-4">
                      We use industry-standard security measures to protect your data, including 256-bit SSL encryption, secure data centers, and regular security audits. However, no method of transmission over the Internet is 100% secure.
                    </p>
                  </section>

                  <section id="rights" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">Your Rights</h2>
                    <p className="text-foreground/70 leading-relaxed mb-4">
                      You have the right to:
                    </p>
                    <ul className="space-y-2 text-foreground/70 mb-6">
                      <li>• Access your personal data</li>
                      <li>• Correct inaccurate data</li>
                      <li>• Delete your account and data</li>
                      <li>• Export your data</li>
                      <li>• Opt out of marketing communications</li>
                    </ul>
                  </section>

                  <section id="contact" className="mb-12">
                    <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
                    <p className="text-foreground/70 leading-relaxed mb-4">
                      If you have questions about this Privacy Policy, please contact us at:
                    </p>
                    <p className="text-foreground/70">
                      Email: privacy@finflow.com<br />
                      Address: 123 Finance St, San Francisco, CA 94105
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
