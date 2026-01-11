import { useState, useEffect } from "react";
import { format, startOfDay, addDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  CalendarDays, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  Mail, 
  Wrench,
  CheckCircle2,
  Bell,
  Loader2 
} from "lucide-react";

interface InstallationBooking {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  status: string;
  technician_id: string | null;
  reminder_sent: boolean;
  order_id: string;
  order_type: string;
  installation_slots: {
    id: string;
    slot_date: string;
    slot_time: string;
  };
  technicians: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
}

interface Technician {
  id: string;
  full_name: string;
  phone: string;
  is_active: boolean;
}

interface OrderDetails {
  order_number: string;
  address_line1: string;
  city: string;
  postcode: string;
  plan_name: string;
}

const TIME_SLOT_LABELS: Record<string, string> = {
  "09:00-12:00": "Morning (9am - 12pm)",
  "12:00-15:00": "Afternoon (12pm - 3pm)",
  "15:00-18:00": "Evening (3pm - 6pm)",
};

export function InstallationScheduleView() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<InstallationBooking[]>([]);
  const [orderDetails, setOrderDetails] = useState<Record<string, OrderDetails>>({});
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
  const [isSendingReminders, setIsSendingReminders] = useState(false);

  useEffect(() => {
    fetchTechnicians();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchBookings(selectedDate);
    }
  }, [selectedDate]);

  const fetchTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from("technicians")
        .select("id, full_name, phone, is_active")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error("Error fetching technicians:", error);
    }
  };

  const fetchBookings = async (date: Date) => {
    setIsLoading(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("installation_bookings")
        .select(`
          id,
          customer_name,
          customer_email,
          customer_phone,
          notes,
          status,
          technician_id,
          reminder_sent,
          order_id,
          order_type,
          installation_slots!inner (
            id,
            slot_date,
            slot_time
          ),
          technicians (
            id,
            full_name,
            phone
          )
        `)
        .eq("installation_slots.slot_date", dateStr)
        .neq("status", "cancelled")
        .order("installation_slots(slot_time)");

      if (error) throw error;
      setBookings((data as unknown as InstallationBooking[]) || []);

      // Fetch order details for each booking
      const details: Record<string, OrderDetails> = {};
      for (const booking of data || []) {
        if (booking.order_type === 'guest_order') {
          const { data: order } = await supabase
            .from("guest_orders")
            .select("order_number, address_line1, city, postcode, plan_name")
            .eq("id", booking.order_id)
            .single();
          if (order) {
            details[booking.id] = order;
          }
        }
      }
      setOrderDetails(details);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast({ title: "Failed to load bookings", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignTechnician = async (bookingId: string, technicianId: string | null) => {
    setUpdatingBookingId(bookingId);
    try {
      const { error } = await supabase
        .from("installation_bookings")
        .update({ technician_id: technicianId || null })
        .eq("id", bookingId);

      if (error) throw error;

      // Update local state
      setBookings(bookings.map(b => {
        if (b.id === bookingId) {
          const tech = technicians.find(t => t.id === technicianId);
          return {
            ...b,
            technician_id: technicianId || null,
            technicians: tech ? { id: tech.id, full_name: tech.full_name, phone: tech.phone } : null
          };
        }
        return b;
      }));

      toast({ title: technicianId ? "Technician assigned" : "Technician unassigned" });
    } catch (error) {
      console.error("Error assigning technician:", error);
      toast({ title: "Failed to assign technician", variant: "destructive" });
    } finally {
      setUpdatingBookingId(null);
    }
  };

  const handleSendReminders = async () => {
    setIsSendingReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke("installation-reminders");

      if (error) throw error;

      toast({
        title: "Reminders sent",
        description: `Processed ${data.processed} reminder(s) for ${data.date}`,
      });

      // Refresh to show updated reminder status
      fetchBookings(selectedDate);
    } catch (error) {
      console.error("Error sending reminders:", error);
      toast({ title: "Failed to send reminders", variant: "destructive" });
    } finally {
      setIsSendingReminders(false);
    }
  };

  const handleMarkComplete = async (bookingId: string) => {
    setUpdatingBookingId(bookingId);
    try {
      const { error } = await supabase
        .from("installation_bookings")
        .update({ status: "completed" })
        .eq("id", bookingId);

      if (error) throw error;

      setBookings(bookings.map(b =>
        b.id === bookingId ? { ...b, status: "completed" } : b
      ));

      toast({ title: "Installation marked as complete" });
    } catch (error) {
      console.error("Error marking complete:", error);
      toast({ title: "Failed to update status", variant: "destructive" });
    } finally {
      setUpdatingBookingId(null);
    }
  };

  return (
    <Card className="border-4 border-foreground">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="font-display flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              INSTALLATION SCHEDULE
            </CardTitle>
            <CardDescription>
              View and manage upcoming installations with technician assignments
            </CardDescription>
          </div>
          <Button
            onClick={handleSendReminders}
            disabled={isSendingReminders}
            variant="outline"
            className="border-2 border-foreground gap-2"
          >
            {isSendingReminders ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                SENDING...
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                SEND REMINDERS
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className={cn("p-3 pointer-events-auto border-4 border-foreground")}
              fromDate={addDays(startOfDay(new Date()), -30)}
            />
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Select a date to view installations
            </p>
          </div>

          {/* Bookings List */}
          <div className="lg:col-span-2">
            <h3 className="font-display text-lg mb-4">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </h3>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="border-4 border-dashed border-muted-foreground rounded p-8 text-center">
                <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-display text-lg">NO INSTALLATIONS</p>
                <p className="text-muted-foreground text-sm mt-1">
                  No installations scheduled for this date
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4 pr-4">
                  {bookings.map((booking) => {
                    const order = orderDetails[booking.id];
                    const isUpdating = updatingBookingId === booking.id;

                    return (
                      <div
                        key={booking.id}
                        className={cn(
                          "border-4 p-4 transition-all",
                          booking.status === "completed" 
                            ? "border-primary/50 bg-primary/5" 
                            : "border-foreground"
                        )}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-secondary flex items-center justify-center border-2 border-foreground">
                              <Clock className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="font-display text-lg">
                                {TIME_SLOT_LABELS[booking.installation_slots.slot_time] || booking.installation_slots.slot_time}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {order?.order_number || "Order"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {booking.reminder_sent && (
                              <Badge variant="secondary" className="gap-1">
                                <Bell className="w-3 h-3" />
                                Reminded
                              </Badge>
                            )}
                            <Badge variant={booking.status === "completed" ? "default" : "secondary"}>
                              {booking.status.toUpperCase()}
                            </Badge>
                          </div>
                        </div>

                        {/* Customer Details */}
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <p className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{booking.customer_name}</span>
                            </p>
                            <p className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              {booking.customer_phone}
                            </p>
                            <p className="flex items-center gap-2 text-sm">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              {booking.customer_email}
                            </p>
                          </div>
                          <div className="space-y-2">
                            {order && (
                              <>
                                <p className="flex items-start gap-2 text-sm">
                                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                  <span>
                                    {order.address_line1}<br />
                                    {order.city}, {order.postcode}
                                  </span>
                                </p>
                                <p className="text-sm">
                                  <span className="text-muted-foreground">Plan:</span>{" "}
                                  <span className="font-medium">{order.plan_name}</span>
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Technician Assignment */}
                        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-muted">
                          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                            <Wrench className="w-4 h-4 text-muted-foreground" />
                            <Select
                              value={booking.technician_id || "unassigned"}
                              onValueChange={(value) => 
                                handleAssignTechnician(booking.id, value === "unassigned" ? null : value)
                              }
                              disabled={isUpdating || booking.status === "completed"}
                            >
                              <SelectTrigger className="border-2 border-foreground flex-1">
                                <SelectValue placeholder="Assign technician" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {technicians.map((tech) => (
                                  <SelectItem key={tech.id} value={tech.id}>
                                    {tech.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {booking.status !== "completed" && (
                            <Button
                              onClick={() => handleMarkComplete(booking.id)}
                              disabled={isUpdating}
                              variant="outline"
                              className="border-2 border-primary text-primary gap-2"
                            >
                              {isUpdating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              MARK COMPLETE
                            </Button>
                          )}
                        </div>

                        {booking.notes && (
                          <div className="mt-4 p-3 bg-secondary/50 rounded text-sm">
                            <span className="text-muted-foreground">Notes:</span> {booking.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
