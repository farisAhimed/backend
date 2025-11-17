import cron from 'node-cron';
import { getFirestore } from '../config/firebase.js';
import { sendHabitReminder, sendStreakAlert, sendMotivation } from './fcmService.js';
import { detectInactiveUser, getMotivation } from './geminiAI.js';

/**
 * Initialize all cron jobs for reminders and notifications
 */
export function initializeCronJobs() {
  console.log('⏰ Initializing cron jobs...');

  // Run every hour to check for habit reminders
  cron.schedule('0 * * * *', async () => {
    console.log('🔄 Running hourly reminder check...');
    await checkAndSendReminders();
  });

  // Run daily at 8 AM to send motivational messages
  cron.schedule('0 8 * * *', async () => {
    console.log('🌅 Sending daily motivational messages...');
    await sendDailyMotivations();
  });

  // Run daily at 9 PM to check for inactive users
  cron.schedule('0 21 * * *', async () => {
    console.log('🔍 Checking for inactive users...');
    await checkInactiveUsers();
  });

  // Run daily at 10 PM to send streak alerts
  cron.schedule('0 22 * * *', async () => {
    console.log('🔥 Checking streaks...');
    await checkStreaks();
  });

  console.log('✅ Cron jobs initialized');
}

/**
 * Check and send habit reminders based on schedule
 */
async function checkAndSendReminders() {
  try {
    const db = getFirestore();
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Get all active reminders
    const remindersSnapshot = await db
      .collection('reminders')
      .where('status', '==', 'active')
      .get();

    for (const reminderDoc of remindersSnapshot.docs) {
      const reminder = reminderDoc.data();
      const habitRef = db.collection('habits').doc(reminder.habitId);
      const habitDoc = await habitRef.get();

      if (!habitDoc.exists) continue;

      const habit = habitDoc.data();
      if (habit.archived || habit.paused) continue;

      // Check if reminder time matches current time (within hour window)
      const reminderHour = new Date(reminder.time).getHours();
      
      // AI-optimized window check (if available)
      if (reminder.aiOptimizedWindow) {
        const windowStart = reminder.aiOptimizedWindow.start;
        const windowEnd = reminder.aiOptimizedWindow.end;
        
        if (currentHour >= windowStart && currentHour <= windowEnd) {
          // Check if already checked in today
          const today = new Date().toISOString().split('T')[0];
          const completedDates = habit.completedDates || [];
          
          if (!completedDates.includes(today)) {
            await sendHabitReminder(reminder.userId, reminder.habitId, habit.name);
          }
        }
      } else if (reminderHour === currentHour) {
        // Standard reminder check
        const today = new Date().toISOString().split('T')[0];
        const completedDates = habit.completedDates || [];
        
        if (!completedDates.includes(today)) {
          await sendHabitReminder(reminder.userId, reminder.habitId, habit.name);
        }
      }
    }
  } catch (error) {
    console.error('Error in checkAndSendReminders:', error);
  }
}

/**
 * Send daily motivational messages to active users
 */
async function sendDailyMotivations() {
  try {
    const db = getFirestore();
    const usersSnapshot = await db.collection('users').get();

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      // Get user's habits
      const habitsSnapshot = await db
        .collection('habits')
        .where('userId', '==', userId)
        .where('archived', '==', false)
        .get();

      if (habitsSnapshot.empty) continue;

      const habits = habitsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate total streak
      const totalStreak = habits.reduce((sum, habit) => sum + (habit.streak || 0), 0);
      
      // Get recent activity
      const recentActivity = habits.map(habit => ({
        name: habit.name,
        streak: habit.streak,
        lastCheckIn: habit.completedDates?.[habit.completedDates.length - 1]
      }));

      try {
        const motivation = await getMotivation(userId, totalStreak, recentActivity);
        await sendMotivation(userId, motivation);
      } catch (error) {
        console.error(`Error sending motivation to ${userId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in sendDailyMotivations:', error);
  }
}

/**
 * Check for inactive users and send re-engagement messages
 */
async function checkInactiveUsers() {
  try {
    const db = getFirestore();
    const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);

    const usersSnapshot = await db.collection('users').get();

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const lastActivity = userData.lastActivity || userData.createdAt;

      if (lastActivity && lastActivity.toMillis() < twoDaysAgo) {
        // Get user's habits
        const habitsSnapshot = await db
          .collection('habits')
          .where('userId', '==', userId)
          .where('archived', '==', false)
          .get();

        if (habitsSnapshot.empty) continue;

        const habits = habitsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        try {
          const message = await detectInactiveUser(
            userId,
            lastActivity.toMillis(),
            habits
          );
          await sendMotivation(userId, message);
        } catch (error) {
          console.error(`Error checking inactive user ${userId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in checkInactiveUsers:', error);
  }
}

/**
 * Check streaks and send alerts for milestones
 */
async function checkStreaks() {
  try {
    const db = getFirestore();
    const habitsSnapshot = await db
      .collection('habits')
      .where('archived', '==', false)
      .where('paused', '==', false)
      .get();

    for (const habitDoc of habitsSnapshot.docs) {
      const habit = habitDoc.data();
      const streak = habit.streak || 0;

      // Send alert for milestone streaks (7, 30, 100, etc.)
      if (streak > 0 && (streak === 7 || streak === 30 || streak === 50 || streak === 100 || streak % 100 === 0)) {
        await sendStreakAlert(habit.userId, habit.name, streak);
      }
    }
  } catch (error) {
    console.error('Error in checkStreaks:', error);
  }
}






