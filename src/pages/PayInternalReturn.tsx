import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Radio, Wifi, PhoneCall } from "lucide-react";
import SEO from "@/components/seo/SEO";

/**
 * Safe landing page for Worldpay HPP browser return.
 * This page NEVER marks a payment as paid — settlement is confirmed
 * server-side via the Worldpay webhook only.
 */
export default function PayInternalReturn() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <SEO title="Payment received | Occta" description="Payment received — we're confirming your order." noIndex />

      <div className="w-full max-w-xl border-2 border-foreground bg-card p-8 md:p-12 relative overflow-hidden">
        {/* Telecom-themed animated signal waves */}
        <div className="pointer-events-none absolute -top-10 -right-10 opacity-20" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border-2 border-foreground"
              style={{ width: 80 + i * 60, height: 80 + i * 60, top: -(i * 30), right: -(i * 30) }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.1, 0.6] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
            />
          ))}
        </div>

        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="flex items-center justify-center w-16 h-16 border-2 border-foreground bg-primary mb-6"
        >
          <CheckCircle2 className="h-9 w-9 text-primary-foreground" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-3xl md:text-4xl font-black uppercase tracking-tight mb-3"
        >
          Payment received
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-base md:text-lg text-muted-foreground mb-8"
        >
          We're confirming your order and will contact you with the next steps.
        </motion.p>

        {/* Telecom signal animation row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-between gap-4 border-2 border-foreground p-4 mb-8 bg-muted/30"
        >
          <div className="flex flex-col items-center gap-1">
            <PhoneCall className="h-6 w-6" />
            <span className="text-[10px] uppercase font-bold tracking-wider">You</span>
          </div>

          <div className="flex-1 flex items-center justify-center gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.span
                key={i}
                className="block h-1 w-full bg-foreground origin-left"
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-1">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Radio className="h-6 w-6" />
            </motion.div>
            <span className="text-[10px] uppercase font-bold tracking-wider">Occta</span>
          </div>

          <div className="flex-1 flex items-center justify-center gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.span
                key={i}
                className="block h-1 w-full bg-foreground origin-left"
                animate={{ scaleX: [0, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: 0.4 + i * 0.12, ease: "easeInOut" }}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-1">
            <Wifi className="h-6 w-6" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Live</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Button asChild className="flex-1 border-2 border-foreground">
            <Link to="/">Back to home</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 border-2 border-foreground">
            <Link to="/dashboard">View account</Link>
          </Button>
        </motion.div>

        <p className="mt-6 text-xs text-muted-foreground text-center">
          You don't need to do anything else right now — confirmation will arrive by email.
        </p>
      </div>
    </main>
  );
}