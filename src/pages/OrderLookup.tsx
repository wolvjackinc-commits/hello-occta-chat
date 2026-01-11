import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Package, MapPin, Calendar, CheckCircle2, Clock, Truck, Home, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

type OrderStatus = 'pending' | 'processing' | 'dispatched' | 'installed' | 'active' | 'cancelled';

interface OrderResult {
  id: string;
  order_number: string;
  full_name: string;
  email: string;
  service_type: string;
  plan_name: string;
  plan_price: number;
  status: string;
  created_at: string;
  address_line1: string;
  city: string;
  postcode: string;
}

const statusConfig: Record<OrderStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: "Order Placed", icon: <Clock className="w-5 h-5" />, color: "bg-warning text-warning-foreground" },
  processing: { label: "Processing", icon: <Package className="w-5 h-5" />, color: "bg-accent text-accent-foreground" },
  dispatched: { label: "Dispatched", icon: <Truck className="w-5 h-5" />, color: "bg-secondary text-secondary-foreground" },
  installed: { label: "Installation", icon: <Home className="w-5 h-5" />, color: "bg-primary/80 text-primary-foreground" },
  active: { label: "Active", icon: <CheckCircle2 className="w-5 h-5" />, color: "bg-primary text-primary-foreground" },
  cancelled: { label: "Cancelled", icon: <XCircle className="w-5 h-5" />, color: "bg-destructive text-destructive-foreground" },
};

const statusOrder: OrderStatus[] = ['pending', 'processing', 'dispatched', 'installed', 'active'];

export default function OrderLookup() {
  const { toast } = useToast();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!orderNumber.trim() || !email.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter both order number and email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setNotFound(false);
    setOrder(null);

    try {
      const { data, error } = await supabase
        .from("guest_orders")
        .select("id, order_number, full_name, email, service_type, plan_name, plan_price, status, created_at, address_line1, city, postcode")
        .eq("order_number", orderNumber.trim().toUpperCase())
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setNotFound(true);
        toast({
          title: "Order not found",
          description: "We couldn't find an order matching those details. Please check and try again.",
          variant: "destructive",
        });
      } else {
        setOrder(data);
      }
    } catch (error) {
      console.error("Order lookup error:", error);
      toast({
        title: "Lookup failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentStatusIndex = (status: string): number => {
    const index = statusOrder.indexOf(status as OrderStatus);
    return index >= 0 ? index : 0;
  };

  const isCancelled = order?.status === 'cancelled';

  return (
    <Layout>
      <div className="min-h-screen bg-background py-12">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
                TRACK YOUR ORDER
              </h1>
              <p className="text-muted-foreground text-lg">
                Enter your order number and email to check your order status
              </p>
            </div>

            <Card className="border-4 border-foreground shadow-brutal mb-8">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  ORDER LOOKUP
                </CardTitle>
                <CardDescription>
                  Find your order using the order number from your confirmation email
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLookup} className="space-y-4">
                  <div>
                    <Label htmlFor="orderNumber" className="font-display uppercase">
                      Order Number
                    </Label>
                    <Input
                      id="orderNumber"
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. ORD-XXXXXXXX"
                      className="mt-1 border-2 border-foreground uppercase"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="font-display uppercase">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full border-4 border-foreground bg-primary text-primary-foreground hover:bg-primary/90 font-display uppercase"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        SEARCHING...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        FIND MY ORDER
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {notFound && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center p-8 border-4 border-dashed border-muted-foreground rounded-lg"
              >
                <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-display text-xl mb-2">ORDER NOT FOUND</h3>
                <p className="text-muted-foreground">
                  Double-check your order number and email, or contact support for help.
                </p>
              </motion.div>
            )}

            {order && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Order Header */}
                <Card className="border-4 border-foreground shadow-brutal">
                  <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Order Number</p>
                        <p className="font-display text-2xl">{order.order_number}</p>
                      </div>
                      <Badge className={`${statusConfig[order.status as OrderStatus]?.color || 'bg-secondary'} text-lg px-4 py-2 uppercase font-display`}>
                        {statusConfig[order.status as OrderStatus]?.label || order.status}
                      </Badge>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-start gap-2">
                        <Package className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground">Service</p>
                          <p className="font-medium capitalize">{order.service_type} - {order.plan_name}</p>
                          <p className="text-primary font-display">£{order.plan_price}/mo</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground">Installation Address</p>
                          <p className="font-medium">{order.address_line1}</p>
                          <p>{order.city}, {order.postcode}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-muted-foreground">Order Date</p>
                          <p className="font-medium">{format(new Date(order.created_at), "dd MMMM yyyy")}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Status Timeline */}
                <Card className="border-4 border-foreground shadow-brutal">
                  <CardHeader>
                    <CardTitle className="font-display">ORDER PROGRESS</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isCancelled ? (
                      <div className="flex items-center gap-4 p-4 bg-destructive/10 border-2 border-destructive rounded">
                        <XCircle className="w-8 h-8 text-destructive" />
                        <div>
                          <p className="font-display text-destructive">ORDER CANCELLED</p>
                          <p className="text-sm text-muted-foreground">
                            This order has been cancelled. Please contact support if you have questions.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        {/* Progress Bar */}
                        <div className="absolute left-6 top-6 bottom-6 w-1 bg-muted" />
                        <div 
                          className="absolute left-6 top-6 w-1 bg-primary transition-all duration-500"
                          style={{ 
                            height: `${(getCurrentStatusIndex(order.status) / (statusOrder.length - 1)) * 100}%`,
                            maxHeight: 'calc(100% - 48px)'
                          }}
                        />

                        <div className="space-y-6 relative">
                          {statusOrder.map((status, index) => {
                            const config = statusConfig[status];
                            const isCompleted = index <= getCurrentStatusIndex(order.status);
                            const isCurrent = order.status === status;

                            return (
                              <div 
                                key={status}
                                className={`flex items-center gap-4 ${isCompleted ? '' : 'opacity-40'}`}
                              >
                                <div 
                                  className={`w-12 h-12 rounded-full flex items-center justify-center border-4 ${
                                    isCurrent 
                                      ? 'border-primary bg-primary text-primary-foreground scale-110' 
                                      : isCompleted 
                                        ? 'border-primary bg-primary/20 text-primary' 
                                        : 'border-muted bg-muted text-muted-foreground'
                                  } transition-all`}
                                >
                                  {config.icon}
                                </div>
                                <div>
                                  <p className={`font-display uppercase ${isCurrent ? 'text-primary' : ''}`}>
                                    {config.label}
                                  </p>
                                  {isCurrent && (
                                    <p className="text-sm text-muted-foreground">Current status</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Help Section */}
                <div className="text-center p-6 bg-secondary border-4 border-foreground">
                  <p className="font-display mb-2">NEED HELP?</p>
                  <p className="text-muted-foreground mb-4">
                    Have questions about your order? Our support team is here to help.
                  </p>
                  <Button asChild variant="outline" className="border-2 border-foreground">
                    <a href="/support">CONTACT SUPPORT</a>
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
