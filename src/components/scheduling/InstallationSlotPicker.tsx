import { useState, useEffect } from "react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CalendarDays, Clock, CheckCircle2 } from "lucide-react";

interface InstallationSlot {
  id: string;
  slot_date: string;
  slot_time: string;
  capacity: number;
  booked_count: number;
}

interface InstallationSlotPickerProps {
  onSlotSelected: (slot: InstallationSlot | null) => void;
  selectedSlot?: InstallationSlot | null;
}

const TIME_SLOT_LABELS: Record<string, string> = {
  "09:00-12:00": "Morning (9am - 12pm)",
  "12:00-15:00": "Afternoon (12pm - 3pm)",
  "15:00-18:00": "Evening (3pm - 6pm)",
};

export function InstallationSlotPicker({ onSlotSelected, selectedSlot }: InstallationSlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableSlots, setAvailableSlots] = useState<InstallationSlot[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Fetch all available dates on mount
  useEffect(() => {
    fetchAvailableDates();
  }, []);

  // Fetch slots when date is selected
  useEffect(() => {
    if (selectedDate) {
      fetchSlotsForDate(selectedDate);
    }
  }, [selectedDate]);

  const fetchAvailableDates = async () => {
    setIsLoading(true);
    try {
      const today = startOfDay(new Date());
      const minDate = addDays(today, 3); // At least 3 days from now

      const { data, error } = await supabase
        .from("installation_slots")
        .select("slot_date, capacity, booked_count")
        .gte("slot_date", format(minDate, "yyyy-MM-dd"))
        .eq("is_active", true);

      if (error) throw error;

      // Get unique dates that have availability
      const datesWithAvailability = [...new Set(
        (data || [])
          .filter(slot => slot.booked_count < slot.capacity)
          .map(slot => slot.slot_date)
      )].map(dateStr => new Date(dateStr));

      setAvailableDates(datesWithAvailability);
    } catch (error) {
      console.error("Error fetching available dates:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSlotsForDate = async (date: Date) => {
    setIsLoadingSlots(true);
    try {
      const { data, error } = await supabase
        .from("installation_slots")
        .select("*")
        .eq("slot_date", format(date, "yyyy-MM-dd"))
        .eq("is_active", true)
        .order("slot_time");

      if (error) throw error;

      // Filter to only show slots with availability
      const available = (data || []).filter(slot => slot.booked_count < slot.capacity);
      setAvailableSlots(available);
    } catch (error) {
      console.error("Error fetching slots:", error);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    onSlotSelected(null); // Clear slot selection when date changes
  };

  const handleSlotSelect = (slot: InstallationSlot) => {
    onSlotSelected(slot);
  };

  const isDateAvailable = (date: Date) => {
    return availableDates.some(d => isSameDay(d, date));
  };

  const getSpotsRemaining = (slot: InstallationSlot) => {
    return slot.capacity - slot.booked_count;
  };

  if (isLoading) {
    return (
      <Card className="border-4 border-foreground">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-4 border-foreground shadow-brutal">
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />
          CHOOSE INSTALLATION DATE
        </CardTitle>
        <CardDescription>
          Select your preferred installation date and time slot
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {availableDates.length === 0 ? (
          <div className="text-center py-8 border-4 border-dashed border-muted-foreground rounded">
            <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-display text-lg">NO SLOTS AVAILABLE</p>
            <p className="text-muted-foreground text-sm mt-2">
              Please check back later or contact support for assistance
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Calendar */}
            <div>
              <p className="font-display text-sm uppercase mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-primary rounded-full"></span>
                Available dates shown in green
              </p>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => !isDateAvailable(date)}
                modifiers={{
                  available: availableDates,
                }}
                modifiersStyles={{
                  available: {
                    backgroundColor: "hsl(var(--primary) / 0.2)",
                    color: "hsl(var(--primary))",
                    fontWeight: "bold",
                  },
                }}
                className={cn("p-3 pointer-events-auto border-4 border-foreground")}
                fromDate={addDays(new Date(), 3)}
              />
            </div>

            {/* Time Slots */}
            <div>
              <p className="font-display text-sm uppercase mb-3">
                {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "Select a date first"}
              </p>
              
              {!selectedDate ? (
                <div className="border-4 border-dashed border-muted-foreground rounded p-8 text-center">
                  <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">Select a date to see available time slots</p>
                </div>
              ) : isLoadingSlots ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="border-4 border-dashed border-muted-foreground rounded p-8 text-center">
                  <Clock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No slots available for this date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableSlots.map((slot) => {
                    const isSelected = selectedSlot?.id === slot.id;
                    const spotsRemaining = getSpotsRemaining(slot);

                    return (
                      <Button
                        key={slot.id}
                        variant="outline"
                        className={cn(
                          "w-full h-auto py-4 px-4 flex items-center justify-between border-4 transition-all",
                          isSelected
                            ? "border-primary bg-primary/10 shadow-brutal"
                            : "border-foreground hover:border-primary hover:bg-primary/5"
                        )}
                        onClick={() => handleSlotSelect(slot)}
                      >
                        <div className="flex items-center gap-3">
                          {isSelected ? (
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                          ) : (
                            <Clock className="w-5 h-5 text-muted-foreground" />
                          )}
                          <div className="text-left">
                            <p className="font-display text-sm">
                              {TIME_SLOT_LABELS[slot.slot_time] || slot.slot_time}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {slot.slot_time}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant={spotsRemaining <= 1 ? "destructive" : "secondary"}
                          className="font-display"
                        >
                          {spotsRemaining} {spotsRemaining === 1 ? "spot" : "spots"} left
                        </Badge>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Summary */}
        {selectedSlot && (
          <div className="bg-primary/10 border-4 border-primary p-4 flex items-center gap-4">
            <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0" />
            <div>
              <p className="font-display text-sm">SELECTED INSTALLATION SLOT</p>
              <p className="text-foreground">
                {format(new Date(selectedSlot.slot_date), "EEEE, MMMM d, yyyy")} • {TIME_SLOT_LABELS[selectedSlot.slot_time] || selectedSlot.slot_time}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
