/**
 * User Model - Firestore Schema
 */

export const UserSchema = {
  uid: 'string',
  email: 'string',
  name: 'string',
  timezone: 'string',
  focusCategories: 'array',
  goalPriorities: 'array',
  preferences: {
    reminderStyle: 'push | email',
    quietHours: { start: 'string', end: 'string' },
    aiTone: 'friendly | strict | motivational | minimalist',
    language: 'en | ar'
  },
  onboardingCompleted: 'boolean',
  createdAt: 'timestamp',
  lastActivity: 'timestamp',
  level: 'number',
  xp: 'number',
  photoURL: 'string | null'
};

/**
 * Create a new user document
 */
export function createUserData(uid, email, name, additionalData = {}) {
  return {
    uid,
    email,
    name,
    timezone: additionalData.timezone || 'UTC',
    focusCategories: additionalData.focusCategories || [],
    goalPriorities: additionalData.goalPriorities || [],
    preferences: {
      reminderStyle: additionalData.reminderStyle || 'push',
      quietHours: additionalData.quietHours || { start: '22:00', end: '08:00' },
      aiTone: additionalData.aiTone || 'friendly',
      language: additionalData.language || 'en'
    },
    onboardingCompleted: false,
    createdAt: new Date(),
    lastActivity: new Date(),
    level: 1,
    xp: 0,
    photoURL: additionalData.photoURL || null,
    ...additionalData
  };
}


