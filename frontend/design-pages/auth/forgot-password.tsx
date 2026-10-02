import { motion } from "motion/react";
import { Link } from "@/lib/react-router-shim";
import { Sparkles, Mail, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { FormEvent, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiRequest<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to request password reset");
      }
    } finally {
      setIsLoading(false);
    }
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
            We'll help you
            <br />
            <span className="bg-gradient-to-r from-[#16a34a] to-[#0891b2] bg-clip-text text-transparent">
              get back in
            </span>
          </h1>
          <p className="text-lg text-foreground/70 leading-relaxed">
            Don't worry! It happens to the best of us. Enter your email and we'll send you a link to reset your password.
          </p>
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

          {!isSuccess ? (
            <Card className="p-8 rounded-3xl border-2">
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2">Reset password</h2>
                <p className="text-foreground/60">
                  Enter your email and we'll send you a reset link
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40" />
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      className="pl-11 rounded-xl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-xl bg-primary hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send reset link"}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <Link to="/signin">
                  <Button type="button" variant="ghost" className="w-full rounded-xl">
                    <ArrowLeft className="mr-2 w-4 h-4" />
                    Back to sign in
                  </Button>
                </Link>
              </form>
            </Card>
          ) : (
            <Card className="p-8 rounded-3xl border-2 bg-gradient-to-br from-[#dcfce7] to-white">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#16a34a] flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Check your email</h2>
                <p className="text-foreground/70 mb-6 leading-relaxed">
                  If an account exists for <strong>{email}</strong>, we've sent password reset instructions.
                </p>
                <p className="text-sm text-foreground/60 mb-8">
                  If you don't receive an email soon, check your spam folder or try again.
                </p>
                <div className="space-y-3">
                  <Button 
                    onClick={() => setIsSuccess(false)}
                    variant="outline"
                    className="w-full rounded-xl"
                  >
                    Try another email
                  </Button>
                  <Link to="/signin">
                    <Button className="w-full rounded-xl bg-primary hover:bg-primary/90">
                      <ArrowLeft className="mr-2 w-4 h-4" />
                      Back to sign in
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
