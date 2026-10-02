import { motion } from "motion/react";
import { Download, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

const pressMentions = [
  { outlet: "TechCrunch", title: "FinFlow raises $10M to democratize personal finance", date: "Jan 2026" },
  { outlet: "The Verge", title: "This budgeting app uses AI to help you save", date: "Dec 2025" },
  { outlet: "Forbes", title: "Best personal finance apps of 2025", date: "Nov 2025" },
  { outlet: "Product Hunt", title: "FinFlow: AI-powered budgeting #1 Product of the Day", date: "Oct 2025" }
];

export function Press() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Press & Media</h1>
            <p className="text-lg text-foreground/70 mb-8">
              News, brand assets, and media inquiries
            </p>
          </motion.div>
        </div>
      </section>

      {/* Brand assets */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">Brand assets</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-8 rounded-3xl border-2">
              <h3 className="text-xl font-bold mb-4">Logo package</h3>
              <p className="text-foreground/70 mb-6">PNG, SVG, and EPS formats</p>
              <Button variant="outline" className="rounded-xl">
                <Download className="mr-2 w-4 h-4" />
                Download logos
              </Button>
            </Card>
            <Card className="p-8 rounded-3xl border-2">
              <h3 className="text-xl font-bold mb-4">Brand guidelines</h3>
              <p className="text-foreground/70 mb-6">Colors, typography, and usage</p>
              <Button variant="outline" className="rounded-xl">
                <Download className="mr-2 w-4 h-4" />
                Download guidelines
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Press mentions */}
      <section className="py-20 bg-[#fafbfc]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-8">Press mentions</h2>
          <div className="space-y-4">
            {pressMentions.map((mention, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="p-6 rounded-2xl border-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-primary mb-2">{mention.outlet}</div>
                      <h3 className="text-lg font-bold mb-1">{mention.title}</h3>
                      <div className="text-sm text-foreground/60">{mention.date}</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-foreground/40 flex-shrink-0" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="p-12 rounded-3xl border-2 bg-gradient-to-br from-[#dcfce7] to-[#cffafe] text-center">
            <Mail className="w-12 h-12 mx-auto mb-6 text-primary" />
            <h2 className="text-3xl font-bold mb-4">Media inquiries</h2>
            <p className="text-foreground/70 mb-8 max-w-md mx-auto">
              For press inquiries, please reach out to our media team
            </p>
            <a href="mailto:press@finflow.com">
              <Button size="lg" className="rounded-xl px-8">
                Contact us
              </Button>
            </a>
          </Card>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
