/**
 * Achievement Service - Handles XP, levels, and achievements
 */

import { getFirestore } from '../config/firebase.js';
import { createAchievementData } from '../models/Achievement.js';
import { createNotificationData } from '../models/Notification.js';
import { LEVEL_XP_REQUIREMENTS, STREAK_MILESTONES, XP_VALUES } from '../config/constants.js';

/**
 * Add XP to user and check for level up
 */
export async function addXP(userId, amount, source = 'check_in') {
  const db = getFirestore();
  
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new Error('User not found');
    }
    
    const user = userDoc.data();
    const currentXP = user.xp || 0;
    const currentLevel = user.level || 1;
    const newXP = currentXP + amount;
    
    // Calculate new level
    let newLevel = currentLevel;
    for (let i = LEVEL_XP_REQUIREMENTS.length - 1; i >= 0; i--) {
      if (newXP >= LEVEL_XP_REQUIREMENTS[i]) {
        newLevel = i + 1;
        break;
      }
    }
    
    const updates = {
      xp: newXP,
      level: newLevel,
      updatedAt: new Date()
    };
    
    await userRef.update(updates);
    
    // Check for level up
    if (newLevel > currentLevel) {
      await handleLevelUp(userId, newLevel);
    }
    
    return {
      xp: newXP,
      level: newLevel,
      levelUp: newLevel > currentLevel
    };
  } catch (error) {
    console.error('Error adding XP:', error);
    throw error;
  }
}

/**
 * Handle level up
 */
async function handleLevelUp(userId, newLevel) {
  const db = getFirestore();
  
  try {
    // Create achievement
    const achievement = createAchievementData(userId, {
      type: 'level',
      title: `Level ${newLevel}!`,
      description: `You've reached level ${newLevel}!`,
      icon: '⭐',
      xpReward: XP_VALUES.LEVEL_UP,
      metadata: { level: newLevel }
    });
    
    await db.collection('achievements').add(achievement);
    
    // Create notification
    const notification = createNotificationData(userId, {
      type: 'achievement',
      title: 'Level Up!',
      message: `Congratulations! You've reached level ${newLevel}!`,
      data: { achievementId: achievement.id, level: newLevel }
    });
    
    await db.collection('notifications').add(notification);
    
    // Award XP for level up
    await addXP(userId, XP_VALUES.LEVEL_UP, 'level_up');
  } catch (error) {
    console.error('Error handling level up:', error);
  }
}

/**
 * Check and unlock achievements based on user actions
 */
export async function checkAchievements(userId, context) {
  const db = getFirestore();
  
  try {
    const achievements = [];
    
    // Check streak achievements
    if (context.type === 'check_in' && context.streak) {
      const streakAchievements = await checkStreakAchievements(userId, context.streak, context.habitId);
      achievements.push(...streakAchievements);
    }
    
    // Check completion achievements
    if (context.type === 'check_in') {
      const completionAchievements = await checkCompletionAchievements(userId, context.habitId);
      achievements.push(...completionAchievements);
    }
    
    // Save achievements and create notifications
    for (const achievement of achievements) {
      const achievementRef = await db.collection('achievements').add(achievement);
      
      const notification = createNotificationData(userId, {
        type: 'achievement',
        title: achievement.title,
        message: achievement.description,
        data: { achievementId: achievementRef.id }
      });
      
      await db.collection('notifications').add(notification);
      
      // Award XP
      await addXP(userId, achievement.xpReward, 'achievement');
    }
    
    return achievements;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return [];
  }
}

/**
 * Check streak achievements
 */
async function checkStreakAchievements(userId, streak, habitId) {
  const db = getFirestore();
  const achievements = [];
  
  // Check if user already has this achievement for this streak
  const existingAchievements = await db.collection('achievements')
    .where('userId', '==', userId)
    .where('type', '==', 'streak')
    .where('metadata.streak', '==', streak)
    .get();
  
  if (!existingAchievements.empty) {
    return []; // Already unlocked
  }
  
  // Check milestone streaks
  if (STREAK_MILESTONES.includes(streak)) {
    const achievement = createAchievementData(userId, {
      type: 'streak',
      title: `${streak} Day Streak!`,
      description: `Amazing! You've maintained a ${streak}-day streak!`,
      icon: streak >= 100 ? '🔥' : streak >= 30 ? '⭐' : '✨',
      xpReward: streak >= 100 ? XP_VALUES.STREAK_100 : streak >= 30 ? XP_VALUES.STREAK_30 : XP_VALUES.STREAK_7,
      metadata: { streak, habitId }
    });
    
    achievements.push(achievement);
  }
  
  return achievements;
}

/**
 * Check completion achievements
 */
async function checkCompletionAchievements(userId, habitId) {
  const db = getFirestore();
  const achievements = [];
  
  // Get habit completions
  const checkInsSnapshot = await db.collection('checkins')
    .where('userId', '==', userId)
    .where('habitId', '==', habitId)
    .where('completed', '==', true)
    .get();
  
  const totalCompletions = checkInsSnapshot.size;
  
  // Check for completion milestones
  const milestones = [10, 25, 50, 100, 250, 500];
  
  for (const milestone of milestones) {
    if (totalCompletions === milestone) {
      // Check if already unlocked
      const existing = await db.collection('achievements')
        .where('userId', '==', userId)
        .where('type', '==', 'completion')
        .where('metadata.completions', '==', milestone)
        .where('metadata.habitId', '==', habitId)
        .get();
      
      if (existing.empty) {
        const achievement = createAchievementData(userId, {
          type: 'completion',
          title: `${milestone} Completions!`,
          description: `You've completed this habit ${milestone} times!`,
          icon: '🎯',
          xpReward: milestone >= 100 ? 100 : milestone >= 50 ? 50 : 25,
          metadata: { completions: milestone, habitId }
        });
        
        achievements.push(achievement);
      }
    }
  }
  
  return achievements;
}

/**
 * Get user achievements
 */
export async function getUserAchievements(userId) {
  const db = getFirestore();
  
  try {
    const snapshot = await db.collection('achievements')
      .where('userId', '==', userId)
      .orderBy('unlockedAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting achievements:', error);
    throw error;
  }
}


