import { motion } from "motion/react";
import { Link } from "@/lib/react-router-shim";
import { Calendar, User, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing-nav";
import { MarketingFooter } from "@/components/marketing-footer";

const posts = [
  {
    slug: "10-ways-to-save-money",
    title: "10 Simple Ways to Save Money Every Month",
    excerpt: "Practical tips to reduce expenses and boost your savings without sacrificing your lifestyle.",
    author: "Sarah Chen",
    date: "Feb 10, 2026",
    category: "Tips",
    readTime: "5 min read"
  },
  {
    slug: "budget-50-30-20-rule",
    title: "The 50/30/20 Budget Rule Explained",
    excerpt: "Learn how to allocate your income using this simple and effective budgeting framework.",
    author: "Marcus Johnson",
    date: "Feb 8, 2026",
    category: "Guides",
    readTime: "7 min read"
  },
  {
    slug: "ai-powered-budgeting",
    title: "How AI is Revolutionizing Personal Finance",
    excerpt: "Discover how artificial intelligence can help you make smarter financial decisions.",
    author: "Elena Rodriguez",
    date: "Feb 5, 2026",
    category: "Features",
    readTime: "6 min read"
  },
  {
    slug: "emergency-fund-guide",
    title: "Building an Emergency Fund: Complete Guide",
    excerpt: "Everything you need to know about creating a financial safety net.",
    author: "Sarah Chen",
    date: "Feb 1, 2026",
    category: "Guides",
    readTime: "8 min read"
  },
  {
    slug: "voice-budgeting",
    title: "Track Expenses with Your Voice",
    excerpt: "Learn how voice commands can make budgeting faster and easier.",
    author: "Alex Kim",
    date: "Jan 28, 2026",
    category: "Features",
    readTime: "4 min read"
  },
  {
    slug: "financial-goals-2026",
    title: "Set Financial Goals That Actually Work",
    excerpt: "A step-by-step guide to creating and achieving your money goals this year.",
    author: "Marcus Johnson",
    date: "Jan 25, 2026",
    category: "Tips",
    readTime: "6 min read"
  }
];

export function Blog() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingNav />

      {/* Hero */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#fafbfc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">FinFlow Blog</h1>
            <p className="text-lg text-foreground/70">
              Tips, guides, and insights to help you master your money
            </p>
          </motion.div>
        </div>
      </section>

      {/* Blog posts grid */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {posts.map((post, i) => (
              <motion.div key={post.slug} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Link to={`/blog/${post.slug}`}>
                  <Card className="p-6 rounded-3xl border-2 h-full hover:shadow-xl transition-all group">
                    <div className="aspect-video bg-gradient-to-br from-[#dcfce7] to-[#cffafe] rounded-2xl mb-4" />
                    <div className="text-xs text-primary mb-3">{post.category}</div>
                    <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{post.title}</h3>
                    <p className="text-foreground/70 mb-4 leading-relaxed">{post.excerpt}</p>
                    <div className="flex items-center gap-4 text-sm text-foreground/60">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{post.author}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{post.date}</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#fafbfc]">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to start managing your money better?</h2>
          <Link to="/signup">
            <Button size="lg" className="px-8 rounded-xl">
              Start free trial <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </motion.div>
      </section>

      <MarketingFooter />
    </div>
  );
}
