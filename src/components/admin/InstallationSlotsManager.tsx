import { useState, useEffect } from "react";
import { format, addDays, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CalendarDays, Plus, Trash2, Clock, Users, Loader2, Wand2 } from "lucide-react";

interface InstallationSlot {
  id: string;
  slot_date: string;
  slot_time: string;
  capacity: number;
  booked_count: number;
  is_active: boolean;
  created_at: string;
}

interface InstallationBooking {
  id: string;
  slot_id: string;
  order_id: string;
  order_type: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  created_at: string;
}

const TIME_SLOTS = [
  { value: "09:00-12:00", label: "Morning (9am - 12pm)" },
  { value: "12:00-15:00", label: "Afternoon (12pm - 3pm)" },
  { value: "15:00-18:00", label: "Evening (3pm - 6pm)" },
];

export function InstallationSlotsManager() {
  const { toast } = useToast();
  const [slots, setSlots] = useState<InstallationSlot[]>([]);
  const [bookings, setBookings] = useState<InstallationBooking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // New slot form
  const [newSlotTime, setNewSlotTime] = useState("09:00-12:00");
  const [newSlotCapacity, setNewSlotCapacity] = useState("3");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Bulk generation
  const [generateDays, setGenerateDays] = useState("14");
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);

  useEffect(() => {
    fetchSlots();
  }, [selectedDate]);

  const fetchSlots = async () => {
    if (!selectedDate) return;
    setIsLoading(true);

    try {
      // Fetch slots for selected date
      const { data: slotsData, error: slotsError } = await supabase
        .from("installation_slots")
        .select("*")
        .eq("slot_date", format(selectedDate, "yyyy-MM-dd"))
        .order("slot_time");

      if (slotsError) throw slotsError;
      setSlots(slotsData || []);

      // Fetch bookings for these slots
      if (slotsData && slotsData.length > 0) {
        const slotIds = slotsData.map(s => s.id);
        const { data: bookingsData, error: bookingsError } = await supabase
          .from("installation_bookings")
          .select("*")
          .in("slot_id", slotIds)
          .neq("status", "cancelled");

        if (bookingsError) throw bookingsError;
        setBookings(bookingsData || []);
      } else {
        setBookings([]);
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
      toast({ title: "Failed to load slots", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSlot = async () => {
    if (!selectedDate) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("installation_slots")
        .insert({
          slot_date: format(selectedDate, "yyyy-MM-dd"),
          slot_time: newSlotTime,
          capacity: parseInt(newSlotCapacity),
        });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "This time slot already exists for this date", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }

      toast({ title: "Slot added successfully" });
      setIsAddDialogOpen(false);
      fetchSlots();
    } catch (error) {
      console.error("Error adding slot:", error);
      toast({ title: "Failed to add slot", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (slot: InstallationSlot) => {
    try {
      const { error } = await supabase
        .from("installation_slots")
        .update({ is_active: !slot.is_active })
        .eq("id", slot.id);

      if (error) throw error;

      setSlots(slots.map(s => 
        s.id === slot.id ? { ...s, is_active: !s.is_active } : s
      ));
      toast({ title: `Slot ${!slot.is_active ? "activated" : "deactivated"}` });
    } catch (error) {
      console.error("Error toggling slot:", error);
      toast({ title: "Failed to update slot", variant: "destructive" });
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure? This will delete the slot and all its bookings.")) return;

    try {
      const { error } = await supabase
        .from("installation_slots")
        .delete()
        .eq("id", slotId);

      if (error) throw error;

      toast({ title: "Slot deleted" });
      fetchSlots();
    } catch (error) {
      console.error("Error deleting slot:", error);
      toast({ title: "Failed to delete slot", variant: "destructive" });
    }
  };

  const handleGenerateSlots = async () => {
    setIsGenerating(true);
    const days = parseInt(generateDays);
    const today = startOfDay(new Date());
    const slotsToCreate: { slot_date: string; slot_time: string; capacity: number }[] = [];

    for (let i = 3; i <= days + 3; i++) { // Start from 3 days ahead
      const date = addDays(today, i);
      const dayOfWeek = date.getDay();
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      TIME_SLOTS.forEach(slot => {
        slotsToCreate.push({
          slot_date: format(date, "yyyy-MM-dd"),
          slot_time: slot.value,
          capacity: 3,
        });
      });
    }

    try {
      const { error } = await supabase
        .from("installation_slots")
        .upsert(slotsToCreate, { 
          onConflict: "slot_date,slot_time",
          ignoreDuplicates: true 
        });

      if (error) throw error;

      toast({ 
        title: "Slots generated successfully", 
        description: `Created ${slotsToCreate.length} slots for the next ${days} days (weekdays only)` 
      });
      setIsGenerateDialogOpen(false);
      fetchSlots();
    } catch (error) {
      console.error("Error generating slots:", error);
      toast({ title: "Failed to generate slots", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const getSlotBookings = (slotId: string) => {
    return bookings.filter(b => b.slot_id === slotId);
  };

  return (
    <Card className="border-4 border-foreground">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="font-display flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              INSTALLATION SLOTS
            </CardTitle>
            <CardDescription>
              Manage available installation dates and times
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-2 border-foreground gap-2">
                  <Wand2 className="w-4 h-4" />
                  BULK GENERATE
                </Button>
              </DialogTrigger>
              <DialogContent className="border-4 border-foreground">
                <DialogHeader>
                  <DialogTitle className="font-display">GENERATE SLOTS</DialogTitle>
                  <DialogDescription>
                    Automatically create slots for upcoming weekdays
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label className="font-display uppercase">Number of Days</Label>
                    <Input
                      type="number"
                      value={generateDays}
                      onChange={(e) => setGenerateDays(e.target.value)}
                      min="7"
                      max="90"
                      className="mt-1 border-2 border-foreground"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Will create 3 time slots per weekday (morning, afternoon, evening)
                    </p>
                  </div>
                  <Button 
                    onClick={handleGenerateSlots} 
                    disabled={isGenerating}
                    className="w-full border-4 border-foreground"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        GENERATING...
                      </>
                    ) : (
                      "GENERATE SLOTS"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="border-4 border-foreground gap-2">
                  <Plus className="w-4 h-4" />
                  ADD SLOT
                </Button>
              </DialogTrigger>
              <DialogContent className="border-4 border-foreground">
                <DialogHeader>
                  <DialogTitle className="font-display">ADD NEW SLOT</DialogTitle>
                  <DialogDescription>
                    Create a new installation slot for {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "selected date"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label className="font-display uppercase">Time Slot</Label>
                    <Select value={newSlotTime} onValueChange={setNewSlotTime}>
                      <SelectTrigger className="mt-1 border-2 border-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map(slot => (
                          <SelectItem key={slot.value} value={slot.value}>
                            {slot.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-display uppercase">Capacity</Label>
                    <Input
                      type="number"
                      value={newSlotCapacity}
                      onChange={(e) => setNewSlotCapacity(e.target.value)}
                      min="1"
                      max="10"
                      className="mt-1 border-2 border-foreground"
                    />
                  </div>
                  <Button 
                    onClick={handleAddSlot} 
                    disabled={isSaving}
                    className="w-full border-4 border-foreground"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        SAVING...
                      </>
                    ) : (
                      "ADD SLOT"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className={cn("p-3 pointer-events-auto border-4 border-foreground")}
              fromDate={new Date()}
            />
          </div>

          {/* Slots for selected date */}
          <div>
            <h3 className="font-display text-lg mb-4">
              {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}
            </h3>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : slots.length === 0 ? (
              <div className="border-4 border-dashed border-muted-foreground rounded p-8 text-center">
                <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No slots for this date</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click "Add Slot" to create one
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4 pr-4">
                  {slots.map((slot) => {
                    const slotBookings = getSlotBookings(slot.id);
                    const spotsRemaining = slot.capacity - slot.booked_count;

                    return (
                      <div
                        key={slot.id}
                        className={cn(
                          "border-4 p-4 transition-all",
                          slot.is_active ? "border-foreground" : "border-muted bg-muted/50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-4 h-4" />
                              <span className="font-display">
                                {TIME_SLOTS.find(t => t.value === slot.slot_time)?.label || slot.slot_time}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span>{slot.booked_count}/{slot.capacity} booked</span>
                              </div>
                              <Badge variant={spotsRemaining > 0 ? "secondary" : "destructive"}>
                                {spotsRemaining > 0 ? `${spotsRemaining} available` : "FULL"}
                              </Badge>
                            </div>

                            {/* Bookings list */}
                            {slotBookings.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-muted space-y-2">
                                {slotBookings.map(booking => (
                                  <div key={booking.id} className="text-sm bg-secondary/50 p-2 rounded">
                                    <p className="font-medium">{booking.customer_name}</p>
                                    <p className="text-muted-foreground">{booking.customer_email}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Active</span>
                              <Switch
                                checked={slot.is_active}
                                onCheckedChange={() => handleToggleActive(slot)}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSlot(slot.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
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
