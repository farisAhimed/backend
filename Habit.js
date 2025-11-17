/**
 * Habit Model - Firestore Schema
 */

export const HabitSchema = {
  id: 'string',
  userId: 'string',
  name: 'string',
  description: 'string',
  category: 'string',
  frequency: {
    type: 'daily | weekly | monthly',
    days: 'array | null', // For weekly: [1,3,5] = Mon, Wed, Fri
    dates: 'array | null', // For monthly: [1,15] = 1st and 15th
    time: 'string | null' // Specific time: "06:00"
  },
  durationTarget: 'number', // minutes
  startDate: 'timestamp',
  endDate: 'timestamp | null',
  difficulty: 'easy | medium | hard',
  color: 'string',
  timed: 'boolean', // Pomodoro-enabled
  status: 'active | paused | archived',
  streak: 'number',
  longestStreak: 'number',
  totalCompletions: 'number',
  completedDates: 'array', // Array of date strings
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

/**
 * Create a new habit document
 */
export function createHabitData(userId, habitData) {
  // Convert date strings to Date objects if they're strings
  let startDate = habitData.startDate;
  if (typeof startDate === 'string') {
    startDate = new Date(startDate);
  } else if (!startDate) {
    startDate = new Date();
  }

  let endDate = habitData.endDate;
  if (typeof endDate === 'string' && endDate) {
    endDate = new Date(endDate);
  } else if (!endDate) {
    endDate = null;
  }

  return {
    userId,
    name: habitData.name,
    description: habitData.description || '',
    category: habitData.category || 'Other',
    frequency: {
      type: habitData.frequency?.type || 'daily',
      days: habitData.frequency?.days || null,
      dates: habitData.frequency?.dates || null,
      time: habitData.frequency?.time || null
    },
    durationTarget: habitData.durationTarget || 0,
    startDate: startDate,
    endDate: endDate,
    difficulty: habitData.difficulty || 'medium',
    color: habitData.color || '#3B82F6',
    timed: habitData.timed || false,
    status: 'active',
    streak: 0,
    longestStreak: 0,
    totalCompletions: 0,
    completedDates: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

