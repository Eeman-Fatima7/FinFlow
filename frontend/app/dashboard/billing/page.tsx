"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { CreditCard, Crown, ReceiptText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold mb-2">Billing & Plans</h1>
        <p className="text-foreground/60">
          Review your current plan and manage billing-related options.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#dcfce7] to-[#cffafe] flex items-center justify-center">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-1">Current Plan</h2>
              <p className="text-sm text-foreground/60 mb-4">
                You are currently on the Free plan.
              </p>
              <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium">
                <CreditCard className="w-3.5 h-3.5" />
                Free Plan Active
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="p-6 rounded-3xl border-2">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#f3e8ff] flex items-center justify-center">
              <ReceiptText className="w-6 h-6 text-[#9333ea]" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-1">Billing Management</h2>
              <p className="text-sm text-foreground/60 mb-4">
                This section is under development. Subscription upgrades and invoice history will be available here.
              </p>
              <Link href="/pricing">
                <Button className="rounded-xl">View available plans</Button>
              </Link>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
