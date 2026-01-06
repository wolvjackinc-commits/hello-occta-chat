import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  broadbandPlans, 
  simPlans, 
  landlinePlans, 
  Plan, 
  calculateBundleDiscount,
  ServiceType 
} from "@/lib/plans";
import { 
  Wifi, 
  Smartphone, 
  PhoneCall, 
  Check, 
  X, 
  Package, 
  ArrowRight,
  Sparkles,
  BadgePercent
} from "lucide-react";

interface BundleBuilderProps {
  currentService?: ServiceType;
}

const BundleBuilder = ({ currentService }: BundleBuilderProps) => {
  const [selectedPlans, setSelectedPlans] = useState<Plan[]>([]);
  const [expandedService, setExpandedService] = useState<ServiceType | null>(null);

  const services = [
    { 
      type: 'broadband' as ServiceType, 
      label: 'Broadband', 
      icon: Wifi, 
      plans: broadbandPlans,
      color: 'bg-primary',
      borderColor: 'border-primary'
    },
    { 
      type: 'sim' as ServiceType, 
      label: 'SIM Plan', 
      icon: Smartphone, 
      plans: simPlans,
      color: 'bg-accent',
      borderColor: 'border-accent'
    },
    { 
      type: 'landline' as ServiceType, 
      label: 'Landline', 
      icon: PhoneCall, 
      plans: landlinePlans,
      color: 'bg-warning',
      borderColor: 'border-warning'
    },
  ];

  const getSelectedPlanForService = (serviceType: ServiceType) => {
    return selectedPlans.find(p => p.serviceType === serviceType);
  };

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlans(prev => {
      const filtered = prev.filter(p => p.serviceType !== plan.serviceType);
      return [...filtered, plan];
    });
    setExpandedService(null);
  };

  const handleRemovePlan = (serviceType: ServiceType) => {
    setSelectedPlans(prev => prev.filter(p => p.serviceType !== serviceType));
  };

  const bundleStats = calculateBundleDiscount(selectedPlans);
  const hasBundle = selectedPlans.length >= 2;

  return (
    <section className="py-20 bg-foreground text-background">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground border-4 border-background mb-6">
            <Package className="w-5 h-5" />
            <span className="font-display uppercase tracking-wider">Bundle Builder</span>
          </div>
          <h2 className="text-display-md mb-4">
            CREATE YOUR
            <span className="text-primary ml-3">PERFECT BUNDLE</span>
          </h2>
          <p className="text-background/70 text-lg max-w-2xl mx-auto">
            Mix and match our services to get exactly what you need. 
            <span className="text-primary font-bold"> Save 10% with 2 services, 15% with all 3!</span>
          </p>
        </motion.div>

        {/* Service Selection Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          {services.map((service, index) => {
            const selectedPlan = getSelectedPlanForService(service.type);
            const isExpanded = expandedService === service.type;
            
            return (
              <motion.div
                key={service.type}
                className="relative"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                {/* Selected Plan Card or Empty Slot */}
                <motion.div
                  className={`bg-background text-foreground border-4 border-background p-6 cursor-pointer transition-all ${
                    selectedPlan ? service.borderColor : ''
                  }`}
                  whileHover={{ y: -4, boxShadow: "8px 8px 0px 0px hsl(var(--primary))" }}
                  onClick={() => setExpandedService(isExpanded ? null : service.type)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 ${service.color} border-4 border-foreground flex items-center justify-center`}>
                      <service.icon className="w-6 h-6" />
                    </div>
                    {selectedPlan && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePlan(service.type);
                        }}
                        className="w-8 h-8 bg-destructive/10 hover:bg-destructive/20 rounded-full flex items-center justify-center transition-colors"
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </button>
                    )}
                  </div>
                  
                  <h3 className="font-display text-xl mb-2">{service.label}</h3>
                  
                  {selectedPlan ? (
                    <div>
                      <p className="font-display text-2xl text-primary mb-1">{selectedPlan.name}</p>
                      <p className="text-lg">
                        <span className="font-display text-3xl">£{selectedPlan.price}</span>
                        <span className="text-muted-foreground">/mo</span>
                      </p>
                      {selectedPlan.speed && (
                        <p className="text-sm text-muted-foreground mt-1">{selectedPlan.speed}Mbps</p>
                      )}
                      {selectedPlan.data && (
                        <p className="text-sm text-muted-foreground mt-1">{selectedPlan.data} data</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      Click to add {service.label.toLowerCase()}
                    </p>
                  )}
                  
                  <div className="mt-4 text-sm text-primary font-display">
                    {isExpanded ? '▲ Close' : '▼ Select Plan'}
                  </div>
                </motion.div>

                {/* Expanded Plan Selection */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      className="absolute top-full left-0 right-0 z-20 mt-2 bg-background border-4 border-foreground shadow-brutal max-h-80 overflow-y-auto"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      {service.plans.map((plan) => (
                        <motion.button
                          key={plan.id}
                          className={`w-full p-4 text-left border-b-2 border-muted hover:bg-muted/50 transition-colors ${
                            selectedPlan?.id === plan.id ? 'bg-primary/10' : ''
                          }`}
                          onClick={() => handleSelectPlan(plan)}
                          whileHover={{ x: 4 }}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-display text-lg">{plan.name}</p>
                              {plan.speed && <p className="text-sm text-muted-foreground">{plan.speed}Mbps</p>}
                              {plan.data && <p className="text-sm text-muted-foreground">{plan.data}</p>}
                              {plan.callRate && <p className="text-sm text-muted-foreground">{plan.callRate}</p>}
                            </div>
                            <div className="text-right">
                              <p className="font-display text-xl">£{plan.price}</p>
                              <p className="text-xs text-muted-foreground">/mo</p>
                            </div>
                          </div>
                          {selectedPlan?.id === plan.id && (
                            <Check className="w-5 h-5 text-primary mt-2" />
                          )}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Bundle Summary */}
        <AnimatePresence>
          {selectedPlans.length > 0 && (
            <motion.div
              className="max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="bg-background text-foreground border-4 border-primary p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-2xl">YOUR BUNDLE</h3>
                  {hasBundle && (
                    <motion.div 
                      className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 border-4 border-foreground"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <BadgePercent className="w-5 h-5" />
                      <span className="font-display">{bundleStats.discountPercentage}% OFF</span>
                    </motion.div>
                  )}
                </div>

                {/* Selected Plans List */}
                <div className="space-y-3 mb-6">
                  {selectedPlans.map((plan) => (
                    <div key={plan.id} className="flex justify-between items-center py-2 border-b border-muted">
                      <div className="flex items-center gap-3">
                        {plan.serviceType === 'broadband' && <Wifi className="w-5 h-5 text-primary" />}
                        {plan.serviceType === 'sim' && <Smartphone className="w-5 h-5 text-accent" />}
                        {plan.serviceType === 'landline' && <PhoneCall className="w-5 h-5 text-warning" />}
                        <span className="font-display">{plan.name}</span>
                        <span className="text-muted-foreground text-sm capitalize">({plan.serviceType})</span>
                      </div>
                      <span className="font-display">£{plan.price}</span>
                    </div>
                  ))}
                </div>

                {/* Pricing */}
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>£{bundleStats.originalTotal.toFixed(2)}</span>
                  </div>
                  {hasBundle && (
                    <motion.div 
                      className="flex justify-between text-primary"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Bundle discount ({bundleStats.discountPercentage}%)
                      </span>
                      <span>-£{bundleStats.savings.toFixed(2)}</span>
                    </motion.div>
                  )}
                  <div className="flex justify-between text-xl font-display pt-4 border-t-4 border-foreground">
                    <span>Monthly Total</span>
                    <span className="text-primary">£{bundleStats.discountedTotal.toFixed(2)}/mo</span>
                  </div>
                </div>

                {/* Not enough for discount message */}
                {!hasBundle && (
                  <p className="text-sm text-muted-foreground mb-4 text-center">
                    Add another service to unlock bundle discounts!
                  </p>
                )}

                {/* CTA */}
                <Link 
                  to={`/pre-checkout?plans=${selectedPlans.map(p => p.id).join(',')}`}
                  className="block"
                >
                  <Button variant="hero" size="lg" className="w-full">
                    Get This Bundle
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {selectedPlans.length === 0 && (
          <motion.p 
            className="text-center text-background/50 text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Select services above to start building your bundle
          </motion.p>
        )}
      </div>
    </section>
  );
};

export default BundleBuilder;
