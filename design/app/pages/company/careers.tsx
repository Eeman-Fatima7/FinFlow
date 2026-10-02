import { motion } from "motion/react";
import { Link } from "react-router";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { MarketingNav } from "../../components/marketing-nav";
import { MarketingFooter } from "../../components/marketing-footer";

const openRoles = [
  { slug: "senior-frontend-engineer", title: "Senior Frontend Engineer", team: "Engineering", location: "Remote", type: "Full-time" },
  { slug: "product-designer", title: "Product Designer", team: "Design", location: "San Francisco, CA", type: "Full-time" },
  { slug: "customer-success-manager", title: "Customer Success Manager", team: "Support", location: "Remote", type: "Full-time" },
  { slug: "backend-engineer", title: "Backend Engineer", team: "Engineering", location: "Remote", type: "Full-time" }
];

export function Careers() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Join our mission</h1>
            <p className="text-lg text-foreground/70">
              Help us make financial wellness accessible to everyone. We're a small team making a big impact.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { icon: "🌍", title: "Remote-first", description: "Work from anywhere in the world" },
              { icon: "💰", title: "Competitive pay", description: "Top of market salary + equity" },
              { icon: "🏥", title: "Great benefits", description: "Health, dental, vision, 401k" }
            ].map((perk, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="p-6 rounded-3xl border-2 text-center">
                  <div className="text-4xl mb-3">{perk.icon}</div>
                  <h3 className="font-bold mb-2">{perk.title}</h3>
                  <p className="text-sm text-foreground/70">{perk.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-12">Open positions</h2>
          <div className="space-y-4">
            {openRoles.map((role, i) => (
              <motion.div key={role.slug} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Link to={`/careers/${role.slug}`}>
                  <Card className="p-6 rounded-2xl border-2 hover:shadow-lg transition-all group">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{role.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-foreground/60">
                          <span>{role.team}</span>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{role.location}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{role.type}</span>
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
