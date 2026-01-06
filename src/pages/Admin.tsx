import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Loader2,
  ShieldCheck,
  Package,
  Users,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  FileText,
  Mail,
  Phone,
  Eye,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { OrderDetailDialog } from "@/components/admin/OrderDetailDialog";
import { UserManageDialog } from "@/components/admin/UserManageDialog";
import { TicketReplyDialog } from "@/components/admin/TicketReplyDialog";

type Order = {
  id: string;
  user_id: string;
  service_type: 'broadband' | 'sim' | 'landline';
  plan_name: string;
  plan_price: number;
  status: 'pending' | 'confirmed' | 'active' | 'cancelled';
  postcode: string;
  address_line1: string | null;
  city: string | null;
  created_at: string;
};

type SupportTicket = {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string | null;
  created_at: string;
};

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
  created_at: string;
};

type GuestOrder = {
  id: string;
  order_number: string;
  service_type: string;
  plan_name: string;
  plan_price: number;
  full_name: string;
  email: string;
  phone: string;
  postcode: string;
  city: string;
  address_line1: string;
  address_line2?: string | null;
  current_provider: string | null;
  user_id: string | null;
  linked_at: string | null;
  created_at: string;
  status: string;
  admin_notes?: string | null;
  in_contract?: boolean;
  preferred_switch_date?: string | null;
  selected_addons?: any;
  additional_notes?: string | null;
  gdpr_consent?: boolean;
  marketing_consent?: boolean;
};

type GuestOrderStatus = 'pending' | 'processing' | 'dispatched' | 'installed' | 'active' | 'cancelled';

const guestOrderStatusOptions: GuestOrderStatus[] = ['pending', 'processing', 'dispatched', 'installed', 'active', 'cancelled'];

type OrderStatus = 'pending' | 'confirmed' | 'active' | 'cancelled';
type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

const orderStatusOptions: OrderStatus[] = ['pending', 'confirmed', 'active', 'cancelled'];
const ticketStatusOptions: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

const statusColors: Record<string, string> = {
  pending: "bg-warning text-warning-foreground",
  confirmed: "bg-accent text-accent-foreground",
  processing: "bg-accent text-accent-foreground",
  dispatched: "bg-secondary text-secondary-foreground",
  installed: "bg-primary/80 text-primary-foreground",
  active: "bg-primary text-primary-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
  open: "bg-warning text-warning-foreground",
  in_progress: "bg-accent text-accent-foreground",
  resolved: "bg-success text-success-foreground",
  closed: "bg-muted text-muted-foreground",
};

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-warning text-warning-foreground",
  high: "bg-destructive/80 text-destructive-foreground",
  urgent: "bg-destructive text-destructive-foreground",
};

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [guestOrders, setGuestOrders] = useState<GuestOrder[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Dialog states
  const [selectedGuestOrder, setSelectedGuestOrder] = useState<GuestOrder | null>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // Check if user has admin role
      const { data: hasAdminRole } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });

      if (!hasAdminRole) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access the admin dashboard.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      setIsLoading(false);
      fetchAllData();
    };

    checkAdminAndFetch();
  }, [navigate, toast]);

  const fetchAllData = async () => {
    setIsDataLoading(true);
    
    try {
      const [ordersResult, guestOrdersResult, ticketsResult, profilesResult] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("guest_orders")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("support_tickets")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (ordersResult.data) setOrders(ordersResult.data as Order[]);
      if (guestOrdersResult.data) setGuestOrders(guestOrdersResult.data);
      if (ticketsResult.data) setTickets(ticketsResult.data as SupportTicket[]);
      if (profilesResult.data) setProfiles(profilesResult.data);
    } catch (error) {
      logError("Admin.fetchAllData", error);
      toast({
        title: "Error",
        description: "Failed to load admin data.",
        variant: "destructive",
      });
    } finally {
      setIsDataLoading(false);
    }
  };

  const getProfileForUser = (userId: string) => {
    return profiles.find(p => p.id === userId);
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update order status.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Updated",
        description: "Order status updated successfully.",
      });
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: TicketStatus) => {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: newStatus })
      .eq("id", ticketId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update ticket status.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Updated",
        description: "Ticket status updated successfully.",
      });
      setTickets(tickets.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    }
  };

  const updateGuestOrderStatus = async (orderId: string, newStatus: GuestOrderStatus) => {
    const order = guestOrders.find(o => o.id === orderId);
    
    const { error } = await supabase
      .from("guest_orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update order status.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Updated",
        description: "Guest order status updated successfully.",
      });
      setGuestOrders(guestOrders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      
      // Send status update email
      if (order && newStatus !== 'pending') {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              type: 'status_update',
              to: order.email,
              data: {
                full_name: order.full_name,
                order_number: order.order_number,
                status: newStatus,
                plan_name: order.plan_name,
                service_type: order.service_type,
              }
            }
          });
        } catch (emailError) {
          logError('Admin.updateGuestOrderStatus.sendEmail', emailError);
        }
      }
    }
  };

  const handleGuestOrderUpdate = (updatedOrder: GuestOrder) => {
    setGuestOrders(guestOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };

  const handleProfileUpdate = (updatedProfile: Profile) => {
    setProfiles(profiles.map(p => p.id === updatedProfile.id ? updatedProfile : p));
  };

  const handleTicketUpdate = (updatedTicket: SupportTicket) => {
    setTickets(tickets.map(t => t.id === updatedTicket.id ? updatedTicket : t));
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="p-4 border-4 border-foreground bg-background">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 md:py-12">
        <motion.div initial="hidden" animate="visible" variants={containerVariants}>
          {/* Header */}
          <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-foreground text-background flex items-center justify-center">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-display-md">ADMIN DASHBOARD</h1>
                <p className="text-muted-foreground font-display uppercase tracking-wider">
                  Manage orders, users & support
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="border-4 border-foreground" 
              onClick={fetchAllData}
              disabled={isDataLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isDataLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Orders", value: orders.length + guestOrders.length, icon: Package, color: "bg-primary" },
              { label: "Pending Orders", value: orders.filter(o => o.status === 'pending').length + guestOrders.filter(o => o.status === 'pending').length, icon: AlertTriangle, color: "bg-warning" },
              { label: "Open Tickets", value: tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length, icon: MessageSquare, color: "bg-accent" },
              { label: "Total Users", value: profiles.length, icon: Users, color: "bg-secondary" },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                className={`p-4 border-4 border-foreground ${stat.color}`}
                whileHover={{ y: -4, x: -4, boxShadow: "8px 8px 0px 0px hsl(var(--foreground))" }}
              >
                <div className="flex items-center gap-3">
                  <stat.icon className="w-6 h-6" />
                  <div>
                    <div className="font-display text-display-sm">{stat.value}</div>
                    <div className="font-display text-xs uppercase tracking-wider">{stat.label}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Tabs */}
          <motion.div variants={itemVariants}>
            <Tabs defaultValue="guest-orders" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 border-4 border-foreground bg-background h-auto p-0">
                <TabsTrigger value="orders" className="font-display uppercase py-3 data-[state=active]:bg-foreground data-[state=active]:text-background border-r-4 border-foreground">
                  <Package className="w-4 h-4 mr-2" />
                  Orders ({orders.length})
                </TabsTrigger>
                <TabsTrigger value="guest-orders" className="font-display uppercase py-3 data-[state=active]:bg-foreground data-[state=active]:text-background border-r-4 border-foreground">
                  <FileText className="w-4 h-4 mr-2" />
                  Guest ({guestOrders.length})
                </TabsTrigger>
                <TabsTrigger value="tickets" className="font-display uppercase py-3 data-[state=active]:bg-foreground data-[state=active]:text-background border-r-4 border-foreground">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Tickets ({tickets.length})
                </TabsTrigger>
                <TabsTrigger value="users" className="font-display uppercase py-3 data-[state=active]:bg-foreground data-[state=active]:text-background">
                  <Users className="w-4 h-4 mr-2" />
                  Users ({profiles.length})
                </TabsTrigger>
              </TabsList>

              {/* Orders Tab */}
              <TabsContent value="orders" className="border-4 border-foreground bg-card">
                {isDataLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : orders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-4 border-foreground bg-secondary">
                          <TableHead className="font-display uppercase">Customer</TableHead>
                          <TableHead className="font-display uppercase">Plan</TableHead>
                          <TableHead className="font-display uppercase">Type</TableHead>
                          <TableHead className="font-display uppercase">Price</TableHead>
                          <TableHead className="font-display uppercase">Location</TableHead>
                          <TableHead className="font-display uppercase">Date</TableHead>
                          <TableHead className="font-display uppercase">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => {
                          const profile = getProfileForUser(order.user_id);
                          return (
                          <TableRow key={order.id} className="border-b-2 border-foreground/20">
                            <TableCell>
                              <div>
                                <p className="font-display">{profile?.full_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{profile?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-display">{order.plan_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="uppercase border-2 border-foreground">
                                {order.service_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-display">£{order.plan_price}/mo</TableCell>
                            <TableCell>
                              <p className="text-sm">{order.city || order.postcode}</p>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(order.created_at), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={order.status} 
                                onValueChange={(value) => updateOrderStatus(order.id, value as OrderStatus)}
                              >
                                <SelectTrigger className={`w-32 border-2 border-foreground ${statusColors[order.status]}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {orderStatusOptions.map((status) => (
                                    <SelectItem key={status} value={status} className="uppercase">
                                      {status}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-display text-lg">NO ORDERS YET</p>
                  </div>
                )}
              </TabsContent>

              {/* Guest Orders Tab */}
              <TabsContent value="guest-orders" className="border-4 border-foreground bg-card">
                {isDataLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : guestOrders.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-4 border-foreground bg-secondary">
                          <TableHead className="font-display uppercase">Order #</TableHead>
                          <TableHead className="font-display uppercase">Customer</TableHead>
                          <TableHead className="font-display uppercase">Contact</TableHead>
                          <TableHead className="font-display uppercase">Plan</TableHead>
                          <TableHead className="font-display uppercase">Date</TableHead>
                          <TableHead className="font-display uppercase">Status</TableHead>
                          <TableHead className="font-display uppercase">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {guestOrders.map((order) => (
                          <TableRow key={order.id} className="border-b-2 border-foreground/20">
                            <TableCell className="font-display font-bold">{order.order_number}</TableCell>
                            <TableCell>
                              <p className="font-display">{order.full_name}</p>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <a href={`mailto:${order.email}`} className="flex items-center gap-1 text-sm text-primary hover:underline">
                                  <Mail className="w-3 h-3" />
                                  {order.email}
                                </a>
                                <a href={`tel:${order.phone}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
                                  <Phone className="w-3 h-3" />
                                  {order.phone}
                                </a>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="font-display">{order.plan_name}</p>
                              <p className="text-xs text-muted-foreground">£{order.plan_price}/mo</p>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(order.created_at), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={order.status} 
                                onValueChange={(value) => updateGuestOrderStatus(order.id, value as GuestOrderStatus)}
                              >
                                <SelectTrigger className={`w-32 border-2 border-foreground ${statusColors[order.status]}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {guestOrderStatusOptions.map((status) => (
                                    <SelectItem key={status} value={status} className="uppercase">
                                      {status}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-2 border-foreground"
                                onClick={() => {
                                  setSelectedGuestOrder(order);
                                  setOrderDialogOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-display text-lg">NO GUEST ORDERS YET</p>
                  </div>
                )}
              </TabsContent>

              {/* Tickets Tab */}
              <TabsContent value="tickets" className="border-4 border-foreground bg-card">
                {isDataLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : tickets.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-4 border-foreground bg-secondary">
                          <TableHead className="font-display uppercase">Customer</TableHead>
                          <TableHead className="font-display uppercase">Subject</TableHead>
                          <TableHead className="font-display uppercase">Category</TableHead>
                          <TableHead className="font-display uppercase">Priority</TableHead>
                          <TableHead className="font-display uppercase">Date</TableHead>
                          <TableHead className="font-display uppercase">Status</TableHead>
                          <TableHead className="font-display uppercase">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tickets.map((ticket) => {
                          const profile = getProfileForUser(ticket.user_id);
                          return (
                          <TableRow key={ticket.id} className="border-b-2 border-foreground/20">
                            <TableCell>
                              <div>
                                <p className="font-display">{profile?.full_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{profile?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="font-display max-w-xs truncate">{ticket.subject}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="uppercase border-2 border-foreground">
                                {ticket.category || 'General'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`uppercase ${priorityColors[ticket.priority]}`}>
                                {ticket.priority}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {format(new Date(ticket.created_at), 'dd MMM yyyy')}
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={ticket.status} 
                                onValueChange={(value) => updateTicketStatus(ticket.id, value as TicketStatus)}
                              >
                                <SelectTrigger className={`w-36 border-2 border-foreground ${statusColors[ticket.status]}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ticketStatusOptions.map((status) => (
                                    <SelectItem key={status} value={status} className="uppercase">
                                      {status.replace('_', ' ')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-2 border-foreground"
                                onClick={() => {
                                  setSelectedTicket(ticket);
                                  setTicketDialogOpen(true);
                                }}
                              >
                                <MessageSquare className="w-4 h-4 mr-1" />
                                Reply
                              </Button>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-display text-lg">NO TICKETS YET</p>
                  </div>
                )}
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users" className="border-4 border-foreground bg-card">
                {isDataLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : profiles.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-4 border-foreground bg-secondary">
                          <TableHead className="font-display uppercase">Name</TableHead>
                          <TableHead className="font-display uppercase">Email</TableHead>
                          <TableHead className="font-display uppercase">Phone</TableHead>
                          <TableHead className="font-display uppercase">Joined</TableHead>
                          <TableHead className="font-display uppercase">Orders</TableHead>
                          <TableHead className="font-display uppercase">Tickets</TableHead>
                          <TableHead className="font-display uppercase">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profiles.map((profile) => {
                          const userOrders = orders.filter(o => o.user_id === profile.id);
                          const userTickets = tickets.filter(t => t.user_id === profile.id);
                          return (
                            <TableRow key={profile.id} className="border-b-2 border-foreground/20">
                              <TableCell className="font-display">{profile.full_name || 'Not set'}</TableCell>
                              <TableCell>{profile.email || 'Not set'}</TableCell>
                              <TableCell>{profile.phone || '—'}</TableCell>
                              <TableCell className="text-sm">
                                {format(new Date(profile.created_at), 'dd MMM yyyy')}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-2 border-foreground">
                                  {userOrders.length}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-2 border-foreground">
                                  {userTickets.length}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-2 border-foreground"
                                  onClick={() => {
                                    setSelectedProfile(profile);
                                    setUserDialogOpen(true);
                                  }}
                                >
                                  <Settings className="w-4 h-4 mr-1" />
                                  Manage
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-display text-lg">NO USERS YET</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      </div>

      {/* Dialogs */}
      <OrderDetailDialog
        order={selectedGuestOrder}
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        onUpdate={handleGuestOrderUpdate}
      />

      <UserManageDialog
        profile={selectedProfile}
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        onUpdate={handleProfileUpdate}
      />

      <TicketReplyDialog
        ticket={selectedTicket}
        profile={selectedTicket ? getProfileForUser(selectedTicket.user_id) || null : null}
        open={ticketDialogOpen}
        onOpenChange={setTicketDialogOpen}
        onUpdate={handleTicketUpdate}
      />
    </Layout>
  );
};

export default Admin;
