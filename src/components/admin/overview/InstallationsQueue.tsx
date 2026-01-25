import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { QueueSkeleton } from "./QueueSkeleton";
import { QueueErrorBoundary } from "./QueueErrorBoundary";
import { format, addDays } from "date-fns";
import { MoreHorizontal, ExternalLink, Calendar, UserCheck, CalendarDays } from "lucide-react";

const PAGE_SIZE = 10;

type EnrichedBooking = {
  id: string;
  order_id: string;
  order_type: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  technician_id: string | null;
  created_at: string;
  slot_date: string | null;
  slot_time: string | null;
  technician_name: string | null;
  postcode: string;
  accountNumber: string;
};

const InstallationsQueueContent = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const today = format(new Date(), "yyyy-MM-dd");
  const sevenDaysFromNow = format(addDays(new Date(), 7), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["installations-queue", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Get installation slots for the next 7 days
      const { data: slots } = await supabase
        .from("installation_slots")
        .select("id, slot_date, slot_time")
        .gte("slot_date", today)
        .lte("slot_date", sevenDaysFromNow);

      const slotIds = slots?.map((s) => s.id) || [];
      const slotMap = new Map((slots || []).map((s) => [s.id, s]));

      if (slotIds.length === 0) {
        return { bookings: [], total: 0 };
      }

      const { data: bookings, error, count } = await supabase
        .from("installation_bookings")
        .select("id, order_id, order_type, customer_name, customer_email, customer_phone, status, technician_id, created_at, slot_id", { count: "exact" })
        .in("slot_id", slotIds)
        .neq("status", "cancelled")
        .order("created_at", { ascending: true })
        .range(from, to);

      if (error) throw error;

      // Fetch technician names
      const techIds = [...new Set((bookings || []).map((b) => b.technician_id).filter(Boolean))] as string[];
      const { data: technicians } = techIds.length > 0
        ? await supabase.from("technicians").select("id, full_name").in("id", techIds)
        : { data: [] };
      const techMap = new Map((technicians || []).map((t) => [t.id, t.full_name]));

      // Fetch address info based on order_type
      const enrichedBookings: EnrichedBooking[] = await Promise.all(
        (bookings || []).map(async (booking) => {
          let postcode = "";
          let accountNumber = "";
          const slot = slotMap.get(booking.slot_id);

          if (booking.order_type === "guest_order") {
            const { data: guestOrder } = await supabase
              .from("guest_orders")
              .select("postcode, account_number")
              .eq("id", booking.order_id)
              .single();
            postcode = guestOrder?.postcode || "";
            accountNumber = guestOrder?.account_number || "";
          } else {
            const { data: order } = await supabase
              .from("orders")
              .select("postcode, user_id")
              .eq("id", booking.order_id)
              .single();
            postcode = order?.postcode || "";
            if (order?.user_id) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("account_number")
                .eq("id", order.user_id)
                .single();
              accountNumber = profile?.account_number || "";
            }
          }

          return {
            id: booking.id,
            order_id: booking.order_id,
            order_type: booking.order_type,
            customer_name: booking.customer_name,
            customer_email: booking.customer_email,
            customer_phone: booking.customer_phone,
            status: booking.status,
            technician_id: booking.technician_id,
            created_at: booking.created_at,
            slot_date: slot?.slot_date || null,
            slot_time: slot?.slot_time || null,
            technician_name: booking.technician_id ? techMap.get(booking.technician_id) || null : null,
            postcode,
            accountNumber,
          };
        })
      );

      return { bookings: enrichedBookings, total: count || 0 };
    },
  });

  if (isLoading) {
    return <QueueSkeleton rows={5} />;
  }

  const bookings = data?.bookings || [];
  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <Card className="border-2 border-foreground p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          <h2 className="font-display text-lg">Upcoming Installations</h2>
          <Badge variant="secondary">{data?.total || 0}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/installations")}
        >
          View all
        </Button>
      </div>

      {bookings.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          No installations scheduled for the next 7 days.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Date/Time</TableHead>
                <TableHead>Postcode</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-mono text-xs">
                    {booking.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {booking.accountNumber || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {booking.slot_date
                        ? format(new Date(booking.slot_date), "dd MMM")
                        : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {booking.slot_time || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {booking.postcode || "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {booking.technician_name || (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        booking.status === "confirmed"
                          ? "default"
                          : booking.status === "completed"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {booking.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(`/admin/installations?booking=${booking.id}`)
                          }
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Open booking
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(
                              `/admin/installations?booking=${booking.id}&action=reschedule`
                            )
                          }
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Reschedule
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            navigate(
                              `/admin/installations?booking=${booking.id}&action=assign`
                            )
                          }
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          Assign technician
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(
                  (p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        onClick={() => setPage(p)}
                        isActive={page === p}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={
                      page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </Card>
  );
};

export const InstallationsQueue = () => (
  <QueueErrorBoundary queueName="Installations">
    <InstallationsQueueContent />
  </QueueErrorBoundary>
);
