// Push notification utilities for PWA

export const isPushSupported = () => {
  return "Notification" in window && "serviceWorker" in navigator;
};

export const getNotificationPermission = () => {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isPushSupported()) return false;
  
  const permission = await Notification.requestPermission();
  return permission === "granted";
};

export const showLocalNotification = (
  title: string,
  options?: NotificationOptions
) => {
  if (Notification.permission !== "granted") return;

  const defaultOptions: NotificationOptions = {
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    ...options,
  };

  return new Notification(title, defaultOptions);
};

// Show notification for order updates
export const notifyOrderUpdate = (orderNumber: string, status: string) => {
  const statusMessages: Record<string, string> = {
    pending: "Your order is being processed",
    confirmed: "Your order has been confirmed!",
    active: "Your service is now active!",
    cancelled: "Your order has been cancelled",
  };

  const message = statusMessages[status] || `Order status updated to ${status}`;

  showLocalNotification("OCCTA Order Update", {
    body: `Order #${orderNumber}: ${message}`,
    tag: `order-${orderNumber}`,
  });
};

// Show notification for support ticket updates
export const notifyTicketUpdate = (ticketSubject: string, status: string) => {
  const statusMessages: Record<string, string> = {
    open: "Your ticket has been received",
    in_progress: "Support is working on your ticket",
    resolved: "Your ticket has been resolved",
    closed: "Your ticket has been closed",
  };

  const message = statusMessages[status] || `Ticket status updated to ${status}`;

  showLocalNotification("OCCTA Support", {
    body: `${ticketSubject}: ${message}`,
    tag: `ticket-${ticketSubject}`,
  });
};
