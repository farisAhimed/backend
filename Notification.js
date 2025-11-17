/**
 * Notification Model - Firestore Schema
 */

export const NotificationSchema = {
  id: 'string',
  userId: 'string',
  type: 'reminder | streak | achievement | ai_insight | system',
  title: 'string',
  message: 'string',
  data: 'object | null', // Additional data (habitId, etc.)
  read: 'boolean',
  createdAt: 'timestamp'
};

/**
 * Create notification data
 */
export function createNotificationData(userId, notificationData) {
  return {
    userId,
    type: notificationData.type,
    title: notificationData.title,
    message: notificationData.message,
    data: notificationData.data || null,
    read: false,
    createdAt: new Date()
  };
}


