/**
 * Streak Model - Firestore Schema
 */

export const StreakSchema = {
  id: 'string',
  habitId: 'string',
  userId: 'string',
  currentStreak: 'number',
  longestStreak: 'number',
  lastCheckIn: 'timestamp | null',
  streakStartDate: 'timestamp | null',
  updatedAt: 'timestamp'
};

/**
 * Create or update streak data
 */
export function createStreakData(habitId, userId, streakData = {}) {
  return {
    habitId,
    userId,
    currentStreak: streakData.currentStreak || 0,
    longestStreak: streakData.longestStreak || 0,
    lastCheckIn: streakData.lastCheckIn || null,
    streakStartDate: streakData.streakStartDate || null,
    updatedAt: new Date()
  };
}


