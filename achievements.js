/**
 * Achievement Routes
 * Handles achievement system, XP, levels, and badges
 */

import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';
import { getUserAchievements } from '../services/achievementService.js';

const router = express.Router();

// Get all user achievements
router.get('/', authenticateToken, async (req, res) => {
  try {
    const achievements = await getUserAchievements(req.user.uid);
    
    res.json({
      success: true,
      achievements
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get achievements',
      error: error.message
    });
  }
});

// Get user achievements
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const achievements = await getUserAchievements(req.user.uid);
    
    res.json({
      success: true,
      achievements
    });
  } catch (error) {
    console.error('Get user achievements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user achievements',
      error: error.message
    });
  }
});

// Get leaderboard
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { period = 'all' } = req.query;
    
    // Get top users by XP
    const usersSnapshot = await db.collection('users')
      .orderBy('xp', 'desc')
      .limit(100)
      .get();
    
    const leaderboard = usersSnapshot.docs.map((doc, index) => ({
      rank: index + 1,
      userId: doc.id,
      name: doc.data().name,
      xp: doc.data().xp || 0,
      level: doc.data().level || 1
    }));
    
    res.json({
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get leaderboard',
      error: error.message
    });
  }
});

export default router;


