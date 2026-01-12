import { useState } from "react";
import { motion } from "framer-motion";
import { Search, User, Package, Calendar, Phone, Mail, MapPin, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postcode?: string | null;
  date_of_birth?: string | null;
  account_number?: string | null;
  created_at: string;
};

type Order = {
  id: string;
  service_type: string;
  plan_name: string;
  plan_price: number;
  status: string;
  created_at: string;
};

interface CustomerLookupProps {
  onSelectCustomer?: (profile: Profile) => void;
}

export const CustomerLookup = ({ onSelectCustomer }: CustomerLookupProps) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Profile | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Enter search term",
        description: "Please enter an account number to search.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    setSelectedCustomer(null);
    setSearchResults([]);

    try {
      // Search by account number (case-insensitive)
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("account_number", `%${searchQuery.trim()}%`)
        .limit(10);

      if (error) throw error;

      setSearchResults(data || []);

      if (!data || data.length === 0) {
        toast({
          title: "No results",
          description: "No customers found with that account number.",
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search failed",
        description: "Could not search customers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCustomer = async (profile: Profile) => {
    setSelectedCustomer(profile);
    
    // Fetch customer's orders
    try {
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      setCustomerOrders(orders || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }

    if (onSelectCustomer) {
      onSelectCustomer(profile);
    }
  };

  const clearSelection = () => {
    setSelectedCustomer(null);
    setCustomerOrders([]);
  };

  const statusColors: Record<string, string> = {
    pending: "bg-warning text-warning-foreground",
    confirmed: "bg-accent text-accent-foreground",
    active: "bg-primary text-primary-foreground",
    cancelled: "bg-destructive text-destructive-foreground",
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by account number (e.g. OCC12345678)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10 border-2 border-foreground font-mono"
            disabled={isSearching}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={isSearching}
          variant="hero"
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Search
            </>
          )}
        </Button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && !selectedCustomer && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-4 border-foreground bg-card"
        >
          <div className="p-3 border-b-2 border-foreground/20 bg-secondary">
            <p className="font-display uppercase text-sm">
              Found {searchResults.length} customer{searchResults.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="divide-y-2 divide-foreground/10">
            {searchResults.map((profile) => (
              <motion.div
                key={profile.id}
                className="p-4 hover:bg-secondary/50 cursor-pointer transition-colors"
                onClick={() => handleSelectCustomer(profile)}
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-foreground text-background flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-display">{profile.full_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {profile.account_number}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{profile.email}</p>
                    {profile.date_of_birth && (
                      <p>DOB: {format(new Date(profile.date_of_birth), "dd MMM yyyy")}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* No Results Message */}
      {hasSearched && searchResults.length === 0 && !isSearching && (
        <div className="p-8 text-center border-4 border-dashed border-foreground/30 bg-muted/30">
          <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="font-display text-lg">NO CUSTOMERS FOUND</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try searching with a different account number
          </p>
        </div>
      )}

      {/* Selected Customer Details */}
      {selectedCustomer && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="border-4 border-foreground bg-card"
        >
          {/* Header */}
          <div className="p-4 border-b-4 border-foreground bg-primary text-primary-foreground flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-foreground text-primary flex items-center justify-center border-2 border-primary-foreground">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display text-lg">{selectedCustomer.full_name || "Unknown"}</h3>
                <p className="text-sm opacity-90 font-mono">{selectedCustomer.account_number}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              className="border-2 border-primary-foreground bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Customer Info */}
          <div className="p-4 grid sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{selectedCustomer.email || "No email"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{selectedCustomer.phone || "No phone"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>
                  DOB: {selectedCustomer.date_of_birth
                    ? format(new Date(selectedCustomer.date_of_birth), "dd MMMM yyyy")
                    : "Not set"}
                </span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  {selectedCustomer.address_line1 ? (
                    <>
                      <p>{selectedCustomer.address_line1}</p>
                      {selectedCustomer.address_line2 && <p>{selectedCustomer.address_line2}</p>}
                      <p>
                        {selectedCustomer.city}
                        {selectedCustomer.city && selectedCustomer.postcode && ", "}
                        {selectedCustomer.postcode}
                      </p>
                    </>
                  ) : (
                    <span className="text-muted-foreground">No address</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>
                  Joined: {format(new Date(selectedCustomer.created_at), "dd MMM yyyy")}
                </span>
              </div>
            </div>
          </div>

          {/* Orders Section */}
          <div className="border-t-4 border-foreground">
            <div className="p-3 bg-secondary flex items-center gap-2">
              <Package className="w-4 h-4" />
              <span className="font-display uppercase text-sm">
                Orders ({customerOrders.length})
              </span>
            </div>
            {customerOrders.length > 0 ? (
              <div className="divide-y divide-foreground/10">
                {customerOrders.map((order) => (
                  <div key={order.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-display">{order.plan_name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {order.service_type} • £{order.plan_price}/mo
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[order.status] || "bg-muted"}>
                        {order.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "dd MMM yy")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No orders found</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
