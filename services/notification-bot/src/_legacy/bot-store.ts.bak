import { type NotificationItem, type NotificationRequest } from "@cpn-engage/shared";

let notifications: NotificationItem[] = [];
let sequence = 0;

export function listNotifications() {
  return notifications;
}

export function resetNotifications() {
  notifications = [];
  sequence = 0;
  return notifications;
}

export function queueNotification(input: NotificationRequest) {
  sequence += 1;
  const notification: NotificationItem = {
    id: `bot-${Date.now()}-${sequence}`,
    ...input
  };

  notifications = [notification, ...notifications];
  return notification;
}
