/**
 * Achievement Model - Firestore Schema
 */

export const AchievementSchema = {
  id: 'string',
  userId: 'string',
  type: 'streak | completion | level | badge | milestone',
  title: 'string',
  description: 'string',
  icon: 'string',
  xpReward: 'number',
  unlockedAt: 'timestamp',
  metadata: 'object | null' // Additional data (streak count, level, etc.)
};

/**
 * Create achievement data
 */
export function createAchievementData(userId, achievementData) {
  return {
    userId,
    type: achievementData.type,
    title: achievementData.title,
    description: achievementData.description,
    icon: achievementData.icon || '🏆',
    xpReward: achievementData.xpReward || 10,
    unlockedAt: new Date(),
    metadata: achievementData.metadata || null
  };
}


