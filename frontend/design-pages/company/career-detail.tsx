import { motion } from "motion/react";
import { Link } from "@/lib/react-router-shim";
import { ArrowLeft, MapPin, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

export function CareerDetail() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <article className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/careers">
            <Button variant="ghost" className="mb-8">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to careers
            </Button>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl font-bold mb-6">Senior Frontend Engineer</h1>
            
            <div className="flex flex-wrap items-center gap-6 text-sm mb-8">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-[#dcfce7] rounded-full">Engineering</span>
              </div>
              <div className="flex items-center gap-2 text-foreground/60">
                <MapPin className="w-4 h-4" />
                <span>Remote</span>
              </div>
              <div className="flex items-center gap-2 text-foreground/60">
                <Clock className="w-4 h-4" />
                <span>Full-time</span>
              </div>
              <div className="flex items-center gap-2 text-foreground/60">
                <DollarSign className="w-4 h-4" />
                <span>$140k - $180k</span>
              </div>
            </div>

            <Card className="p-8 rounded-3xl border-2 mb-8">
              <h2 className="text-2xl font-bold mb-4">About the role</h2>
              <p className="text-foreground/70 leading-relaxed mb-6">
                We're looking for an experienced frontend engineer to help build the future of personal finance. You'll work on our React-based web app, focusing on performance, accessibility, and delightful user experiences.
              </p>

              <h3 className="text-xl font-bold mb-4 mt-8">Responsibilities</h3>
              <ul className="space-y-2 text-foreground/70 mb-6">
                <li>• Build and maintain features for our web application using React and TypeScript</li>
                <li>• Collaborate with designers to implement pixel-perfect, responsive UI</li>
                <li>• Optimize application performance and ensure accessibility standards</li>
                <li>• Write clean, testable code and participate in code reviews</li>
                <li>• Mentor junior engineers and contribute to engineering culture</li>
              </ul>

              <h3 className="text-xl font-bold mb-4 mt-8">Requirements</h3>
              <ul className="space-y-2 text-foreground/70">
                <li>• 5+ years of professional frontend development experience</li>
                <li>• Expert knowledge of React, TypeScript, and modern web technologies</li>
                <li>• Strong understanding of web performance and accessibility</li>
                <li>• Experience with testing frameworks (Jest, React Testing Library)</li>
                <li>• Excellent communication and collaboration skills</li>
              </ul>
            </Card>

            <Button size="lg" className="w-full sm:w-auto px-8 rounded-xl">
              Apply for this position
            </Button>
          </motion.div>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}
