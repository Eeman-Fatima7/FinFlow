import { motion } from "motion/react";
import { Link, useParams } from "@/lib/react-router-shim";
import { Calendar, User, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

export function BlogPost() {
  const { slug } = useParams();
  void slug;

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      <article className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/blog">
            <Button variant="ghost" className="mb-8">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to blog
            </Button>
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-xs text-primary mb-4">Tips</div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">10 Simple Ways to Save Money Every Month</h1>
            
            <div className="flex items-center gap-6 text-sm text-foreground/60 mb-8">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>Sarah Chen</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Feb 10, 2026</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>5 min read</span>
              </div>
            </div>

            <div className="aspect-video bg-gradient-to-br from-[#dcfce7] to-[#cffafe] rounded-3xl mb-12" />

            <div className="prose prose-lg max-w-none">
              <p className="lead text-xl text-foreground/80 leading-relaxed mb-8">
                Saving money doesn't have to mean sacrificing your quality of life. Here are 10 practical ways to reduce expenses and boost your savings.
              </p>

              <h2 className="text-2xl font-bold mt-12 mb-4">1. Track Every Expense</h2>
              <p className="text-foreground/70 leading-relaxed mb-6">
                The first step to saving is knowing where your money goes. Use FinFlow to automatically track and categorize every transaction. You might be surprised where your money is actually going.
              </p>

              <h2 className="text-2xl font-bold mt-12 mb-4">2. Cancel Unused Subscriptions</h2>
              <p className="text-foreground/70 leading-relaxed mb-6">
                Most people have 2-3 subscriptions they forgot about. Review your subscriptions monthly and cancel what you don't use. This alone can save $50-100/month.
              </p>

              <h2 className="text-2xl font-bold mt-12 mb-4">3. Meal Prep on Sundays</h2>
              <p className="text-foreground/70 leading-relaxed mb-6">
                Eating out costs 3-5x more than cooking at home. Dedicate 2-3 hours on Sunday to meal prep for the week. You'll save hundreds per month.
              </p>

              <Card className="p-6 rounded-2xl bg-[#dcfce7] border-0 my-12">
                <p className="text-lg font-medium">
                  💡 Pro tip: Set up automatic transfers to savings on payday. You won't miss what you don't see.
                </p>
              </Card>

              <h2 className="text-2xl font-bold mt-12 mb-4">4. Use the 48-Hour Rule</h2>
              <p className="text-foreground/70 leading-relaxed mb-6">
                Before making any non-essential purchase over $50, wait 48 hours. This reduces impulse buying and helps you evaluate if you really need it.
              </p>

              <h2 className="text-2xl font-bold mt-12 mb-4">5. Negotiate Your Bills</h2>
              <p className="text-foreground/70 leading-relaxed mb-6">
                Call your internet, phone, and insurance providers annually. Simply asking for a better rate can save $20-50/month per service.
              </p>

              <h2 className="text-2xl font-bold mt-12 mb-4">Ready to start saving?</h2>
              <p className="text-foreground/70 leading-relaxed mb-6">
                FinFlow makes it easy to track expenses, set budgets, and hit your savings goals. Start your free 14-day trial today.
              </p>

              <Link to="/signup">
                <Button size="lg" className="rounded-xl">Start free trial</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}
