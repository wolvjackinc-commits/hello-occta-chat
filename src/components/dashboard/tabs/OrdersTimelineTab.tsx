import { CustomerJourneyTimeline } from "@/components/dashboard/CustomerJourneyTimeline";

export function OrdersTimelineTab({ userId, userEmail }: { userId: string; userEmail: string | null }) {
  return <CustomerJourneyTimeline userId={userId} userEmail={userEmail} />;
}