import { motion } from "motion/react";
import { Link } from "@/lib/react-router-shim";
import { Sparkles, Menu, X, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";

export function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold">FinFlow</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/features" className="text-sm text-foreground/70 hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="text-sm text-foreground/70 hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/security" className="text-sm text-foreground/70 hover:text-foreground transition-colors">Security</Link>
            <Link to="/blog" className="text-sm text-foreground/70 hover:text-foreground transition-colors">Resources</Link>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/signin">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-primary hover:bg-primary/90">
                Get started <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button 
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="md:hidden border-t border-border bg-white"
        >
          <div className="px-4 py-4 space-y-4">
            <Link to="/features" className="block text-sm" onClick={() => setMobileMenuOpen(false)}>Features</Link>
            <Link to="/pricing" className="block text-sm" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            <Link to="/security" className="block text-sm" onClick={() => setMobileMenuOpen(false)}>Security</Link>
            <Link to="/blog" className="block text-sm" onClick={() => setMobileMenuOpen(false)}>Resources</Link>
            <div className="flex flex-col gap-2 pt-4">
              <Link to="/signin" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">Sign in</Button>
              </Link>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full">Get started</Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}
