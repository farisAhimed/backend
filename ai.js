import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  analyzeProgress,
  getMotivation,
  recommendHabits,
  detectInactiveUser,
  forecastStreakRisk,
} from '../services/geminiAI.js';

const router = express.Router();

// Analyze progress
router.post('/analyzeProgress', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const habitsSnapshot = await db
      .collection('habits')
      .where('userId', '==', req.user.uid)
      .where('archived', '==', false)
      .get();

    const habits = habitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get recent check-ins (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const checkIns = habits.flatMap(habit => 
      (habit.completedDates || [])
        .filter(date => new Date(date) >= thirtyDaysAgo)
        .map(date => ({ habitId: habit.id, habitName: habit.name, date }))
    );

    const analysis = await analyzeProgress(req.user.uid, habits, checkIns);

    res.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('Analyze progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze progress',
      error: error.message,
    });
  }
});

// Get motivation
router.post('/getMotivation', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const habitsSnapshot = await db
      .collection('habits')
      .where('userId', '==', req.user.uid)
      .where('archived', '==', false)
      .get();

    const habits = habitsSnapshot.docs.map(doc => doc.data());
    const totalStreak = habits.reduce((sum, habit) => sum + (habit.streak || 0), 0);
    
    const recentActivity = habits.map(habit => ({
      name: habit.name,
      streak: habit.streak,
      lastCheckIn: habit.completedDates?.[habit.completedDates.length - 1],
    }));

    const motivation = await getMotivation(req.user.uid, totalStreak, recentActivity);

    res.json({
      success: true,
      motivation,
    });
  } catch (error) {
    console.error('Get motivation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get motivation',
      error: error.message,
    });
  }
});

// Recommend habits
router.post('/recommendHabits', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const habitsSnapshot = await db
      .collection('habits')
      .where('userId', '==', req.user.uid)
      .where('archived', '==', false)
      .get();

    const existingHabits = habitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userGoals = userDoc.data()?.goals || [];

    const recommendations = await recommendHabits(
      req.user.uid,
      existingHabits,
      userGoals
    );

    res.json({
      success: true,
      recommendations,
    });
  } catch (error) {
    console.error('Recommend habits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendations',
      error: error.message,
    });
  }
});

// Detect inactive user
router.post('/detectInactiveUser', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.data();
    const lastActivity = userData?.lastActivity?.toMillis() || userData?.createdAt?.toMillis() || Date.now();

    const habitsSnapshot = await db
      .collection('habits')
      .where('userId', '==', req.user.uid)
      .where('archived', '==', false)
      .get();

    const habits = habitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    const message = await detectInactiveUser(req.user.uid, lastActivity, habits);

    res.json({
      success: true,
      message,
      lastActivity: new Date(lastActivity).toISOString(),
    });
  } catch (error) {
    console.error('Detect inactive user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to detect inactive user',
      error: error.message,
    });
  }
});

// Forecast streak risk
router.post('/forecastStreakRisk', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const habitsSnapshot = await db
      .collection('habits')
      .where('userId', '==', req.user.uid)
      .where('archived', '==', false)
      .get();

    const habits = habitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    const forecast = await forecastStreakRisk(req.user.uid, habits);

    res.json({
      success: true,
      forecast,
    });
  } catch (error) {
    console.error('Forecast streak risk error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to forecast streak risk',
      error: error.message,
    });
  }
});

export default router;



