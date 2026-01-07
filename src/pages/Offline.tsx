import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { WifiOff, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const OfflinePage = () => {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-sm"
      >
        {/* Icon */}
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-24 h-24 mx-auto mb-6 bg-muted border-4 border-foreground flex items-center justify-center"
        >
          <WifiOff className="w-12 h-12 text-muted-foreground" />
        </motion.div>

        {/* Title */}
        <h1 className="font-display text-3xl uppercase mb-3">
          You're Offline
        </h1>

        {/* Description */}
        <p className="text-muted-foreground mb-6">
          It looks like you've lost your internet connection. 
          Some features may be unavailable until you're back online.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <Button 
            onClick={handleRetry} 
            variant="hero" 
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>

          <Link to="/" className="block">
            <Button variant="outline" className="w-full border-4 border-foreground">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 p-4 bg-secondary border-2 border-foreground text-left"
        >
          <p className="font-display text-sm uppercase mb-2">While you wait:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Check your WiFi or mobile data</li>
            <li>• Move to an area with better signal</li>
            <li>• Try turning airplane mode on and off</li>
          </ul>
        </motion.div>

        {/* Cached content notice */}
        <p className="text-xs text-muted-foreground mt-6">
          Some previously viewed content may still be available.
        </p>
      </motion.div>
    </div>
  );
};

export default OfflinePage;
