import admin, { getFirestore } from '../config/firebase.js';

/**
 * Send FCM notification to user
 */
export async function sendNotification(userId, title, body, data = {}) {
  try {
    const db = getFirestore();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log(`No FCM token for user ${userId}`);
      return { success: false, message: 'No FCM token registered' };
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        timestamp: Date.now().toString(),
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent:', response);

    return { success: true, messageId: response };
  } catch (error) {
    console.error('❌ FCM Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send habit reminder
 */
export async function sendHabitReminder(userId, habitId, habitName) {
  return await sendNotification(
    userId,
    'Habit Reminder',
    `Time to check in: ${habitName}`,
    {
      type: 'habit_reminder',
      habitId,
    }
  );
}

/**
 * Send streak alert
 */
export async function sendStreakAlert(userId, habitName, streak) {
  return await sendNotification(
    userId,
    '🔥 Streak Alert!',
    `You're on a ${streak}-day streak with ${habitName}! Keep it up!`,
    {
      type: 'streak_alert',
      streak: streak.toString(),
    }
  );
}

/**
 * Send streak end alert
 */
export async function sendStreakEndAlert(userId, habitName, previousStreak) {
  return await sendNotification(
    userId,
    'Don\'t Give Up!',
    `Your ${previousStreak}-day streak with ${habitName} ended. You can start a new one today!`,
    {
      type: 'streak_end',
      previousStreak: previousStreak.toString(),
    }
  );
}

/**
 * Send motivational message
 */
export async function sendMotivation(userId, message) {
  return await sendNotification(
    userId,
    '💪 Your Daily Motivation',
    message,
    {
      type: 'motivation',
    }
  );
}

