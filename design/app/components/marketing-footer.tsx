import { Link } from "react-router";
import { Sparkles } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer className="bg-white border-t py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold">FinFlow</span>
            </Link>
            <p className="text-sm text-foreground/60">
              Beautiful, intelligent personal finance for everyone.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-4">Product</h4>
            <div className="space-y-2 text-sm text-foreground/60">
              <Link to="/features" className="block hover:text-foreground transition-colors">Features</Link>
              <Link to="/pricing" className="block hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/security" className="block hover:text-foreground transition-colors">Security</Link>
              <Link to="/roadmap" className="block hover:text-foreground transition-colors">Roadmap</Link>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-4">Company</h4>
            <div className="space-y-2 text-sm text-foreground/60">
              <Link to="/about" className="block hover:text-foreground transition-colors">About</Link>
              <Link to="/blog" className="block hover:text-foreground transition-colors">Blog</Link>
              <Link to="/careers" className="block hover:text-foreground transition-colors">Careers</Link>
              <Link to="/press" className="block hover:text-foreground transition-colors">Press</Link>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-4">Legal</h4>
            <div className="space-y-2 text-sm text-foreground/60">
              <Link to="/privacy" className="block hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/terms" className="block hover:text-foreground transition-colors">Terms</Link>
              <Link to="/security" className="block hover:text-foreground transition-colors">Security</Link>
              <Link to="/compliance" className="block hover:text-foreground transition-colors">Compliance</Link>
            </div>
          </div>
        </div>
        <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-foreground/60">
            © 2026 FinFlow. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-foreground/60">
            <a href="#" className="hover:text-foreground transition-colors">Twitter</a>
            <a href="#" className="hover:text-foreground transition-colors">LinkedIn</a>
            <a href="#" className="hover:text-foreground transition-colors">Instagram</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
