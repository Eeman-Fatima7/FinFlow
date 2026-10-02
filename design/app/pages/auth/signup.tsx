import { motion } from "motion/react";
import { Link } from "react-router";
import { Sparkles, Mail, Lock, User, ArrowRight, Check } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card } from "../../components/ui/card";
import { Separator } from "../../components/ui/separator";
import { useState } from "react";

export function SignUp() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      window.location.href = "/app";
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background grid md:grid-cols-2">
      {/* Left side */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-[#dcfce7] via-[#cffafe] to-[#dbeafe] relative overflow-hidden">
        <Link to="/" className="flex items-center gap-2 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-semibold">FinFlow</span>
        </Link>

        <div className="relative z-10">
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Start your journey to
            <br />
            <span className="bg-gradient-to-r from-[#16a34a] to-[#0891b2] bg-clip-text text-transparent">
              financial freedom
            </span>
          </h1>
          <p className="text-lg text-foreground/70 mb-8 leading-relaxed">
            Join 500,000+ people who have transformed their relationship with money.
          </p>

          {/* Benefits */}
          <div className="space-y-3">
            {[
              "14-day free trial, no credit card required",
              "AI-powered insights from day one",
              "Bank-level security and encryption",
              "Cancel anytime, keep your data"
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#16a34a] flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
                <span className="text-foreground/70">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute top-20 right-20 w-64 h-64 bg-[#86efac] rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-20 left-20 w-64 h-64 bg-[#67e8f9] rounded-full blur-3xl opacity-30" />
      </div>

      {/* Right side */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="md:hidden mb-8">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#86efac] to-[#67e8f9] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold">FinFlow</span>
            </Link>
          </div>

          <Card className="p-8 rounded-3xl border-2">
            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Create account</h2>
              <p className="text-foreground/60">
                Already have an account?{" "}
                <Link to="/signin" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Full name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
                  <Input
                    type="text"
                    placeholder="Alex Johnson"
                    className="pl-11 rounded-xl"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    className="pl-11 rounded-xl"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    className="pl-11 rounded-xl"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                <p className="text-xs text-foreground/60 mt-2">
                  Must be at least 8 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    className="pl-11 rounded-xl"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input 
                  type="checkbox" 
                  className="mt-1 rounded" 
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  required
                />
                <label className="text-sm text-foreground/70">
                  I agree to the{" "}
                  <Link to="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              <Button 
                type="submit" 
                className="w-full rounded-xl bg-primary hover:bg-primary/90"
                disabled={isLoading || !agreedToTerms}
              >
                {isLoading ? "Creating account..." : "Create account"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>

              <div className="relative">
                <Separator />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-sm text-foreground/60">
                  Or sign up with
                </span>
              </div>

              <Button 
                type="button" 
                variant="outline" 
                className="w-full rounded-xl"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
