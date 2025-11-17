/**
 * CheckIn Model - Firestore Schema
 */

export const CheckInSchema = {
  id: 'string',
  habitId: 'string',
  userId: 'string',
  date: 'timestamp',
  completed: 'boolean',
  completionPercentage: 'number', // 0-100
  notes: 'string | null',
  photoUrl: 'string | null',
  mood: 'string | null',
  createdAt: 'timestamp'
};

/**
 * Create a new check-in document
 */
export function createCheckInData(habitId, userId, checkInData) {
  const date = checkInData.date || new Date();
  
  return {
    habitId,
    userId,
    date,
    completed: checkInData.completed !== false,
    completionPercentage: checkInData.completionPercentage || (checkInData.completed !== false ? 100 : 0),
    notes: checkInData.notes || null,
    photoUrl: checkInData.photoUrl || null,
    mood: checkInData.mood || null,
    createdAt: new Date()
  };
}


