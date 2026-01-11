import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck, 
  Home,
  AlertCircle,
  XCircle,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OrderStep {
  id: string;
  label: string;
  description: string;
  status: "completed" | "current" | "upcoming" | "cancelled";
  date?: string;
}

interface Order {
  id: string;
  order_number?: string;
  plan_name: string;
  plan_price: number;
  service_type: string;
  status: string;
  created_at: string;
  installation_date?: string | null;
  admin_notes?: string | null;
}

interface OrderTrackingProps {
  order: Order;
  onContactSupport?: () => void;
}

const getOrderSteps = (order: Order): OrderStep[] => {
  const steps: OrderStep[] = [
    {
      id: "placed",
      label: "Order Placed",
      description: "We've received your order",
      status: "completed",
      date: order.created_at,
    },
    {
      id: "processing",
      label: "Processing",
      description: "Verifying your details",
      status: "upcoming",
    },
    {
      id: "confirmed",
      label: "Confirmed",
      description: "Order confirmed and scheduled",
      status: "upcoming",
    },
    {
      id: "installation",
      label: "Installation",
      description: order.installation_date 
        ? `Scheduled for ${format(new Date(order.installation_date), "dd MMM yyyy")}`
        : "Installation date TBC",
      status: "upcoming",
      date: order.installation_date || undefined,
    },
    {
      id: "active",
      label: "Active",
      description: "Service is live!",
      status: "upcoming",
    },
  ];

  // Update step statuses based on order status
  switch (order.status) {
    case "pending":
      steps[0].status = "completed";
      steps[1].status = "current";
      break;
    case "confirmed":
      steps[0].status = "completed";
      steps[1].status = "completed";
      steps[2].status = "completed";
      steps[3].status = "current";
      break;
    case "active":
      steps.forEach(step => step.status = "completed");
      break;
    case "cancelled":
      steps.forEach(step => {
        if (step.status !== "completed") {
          step.status = "cancelled";
        }
      });
      break;
  }

  return steps;
};

const stepIcons = {
  placed: Package,
  processing: Clock,
  confirmed: CheckCircle2,
  installation: Truck,
  active: Home,
};

export const OrderTracking = ({ order, onContactSupport }: OrderTrackingProps) => {
  const steps = getOrderSteps(order);
  const currentStepIndex = steps.findIndex(s => s.status === "current");
  const isCancelled = order.status === "cancelled";

  return (
    <div className="border-4 border-foreground bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-xl uppercase">{order.plan_name}</h3>
          <p className="text-sm text-muted-foreground">
            {order.order_number ? `Order #${order.order_number}` : `ID: ${order.id.slice(0, 8)}`}
          </p>
        </div>
        <div className={cn(
          "px-3 py-1 border-2 border-foreground font-display text-sm uppercase",
          isCancelled ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
        )}>
          {order.status}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {steps.map((step, index) => {
          const Icon = stepIcons[step.id as keyof typeof stepIcons] || Package;
          const isCompleted = step.status === "completed";
          const isCurrent = step.status === "current";
          const isUpcoming = step.status === "upcoming";
          const isCancelledStep = step.status === "cancelled";

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start gap-4 mb-4 last:mb-0"
            >
              {/* Icon and line */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-10 h-10 border-4 flex items-center justify-center transition-colors",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "bg-accent border-accent text-accent-foreground animate-pulse",
                  isUpcoming && "bg-muted border-foreground/30 text-muted-foreground",
                  isCancelledStep && "bg-destructive/20 border-destructive/50 text-destructive"
                )}>
                  {isCancelledStep ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "w-1 h-8 mt-1",
                    isCompleted ? "bg-primary" : "bg-foreground/20"
                  )} />
                )}
              </div>

              {/* Content */}
              <div className="flex-grow pt-1">
                <div className="flex items-center justify-between">
                  <h4 className={cn(
                    "font-display uppercase",
                    isUpcoming && "text-muted-foreground",
                    isCancelledStep && "text-destructive line-through"
                  )}>
                    {step.label}
                  </h4>
                  {step.date && isCompleted && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(step.date), { addSuffix: true })}
                    </span>
                  )}
                </div>
                <p className={cn(
                  "text-sm",
                  isUpcoming || isCancelledStep ? "text-muted-foreground/60" : "text-muted-foreground"
                )}>
                  {step.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Admin Notes */}
      {order.admin_notes && (
        <div className="mt-6 p-4 bg-accent/10 border-2 border-accent">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-display text-sm uppercase text-accent">Update from OCCTA</h4>
              <p className="text-sm text-muted-foreground mt-1">{order.admin_notes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 pt-4 border-t-2 border-foreground/10 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="font-display">Monthly:</span> £{order.plan_price}
        </div>
        {onContactSupport && (
          <Button variant="outline" size="sm" onClick={onContactSupport} className="border-2 border-foreground">
            <MessageSquare className="w-4 h-4 mr-2" />
            Contact Support
          </Button>
        )}
      </div>
    </div>
  );
};

export default OrderTracking;
