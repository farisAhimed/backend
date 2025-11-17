/**
 * Check-in Routes
 * Handles habit check-ins with notes, photos, and mood tracking
 */

import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';
import { createCheckInData } from '../models/CheckIn.js';
import { updateStreak, isDateValidForHabit } from '../services/streakService.js';
import { addXP, checkAchievements } from '../services/achievementService.js';

const router = express.Router();

// Helper function
function formatDateString(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Create check-in
router.post('/', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { habitId, date, completed, completionPercentage, notes, photoUrl, mood } = req.body;
    const userId = req.user.uid;

    // Validate habit exists and belongs to user
    const habitDoc = await db.collection('habits').doc(habitId).get();
    if (!habitDoc.exists) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    const habit = habitDoc.data();
    if (habit.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (habit.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Habit is not active' });
    }

    // Validate date is within habit frequency
    const checkInDate = date ? new Date(date) : new Date();
    if (!isDateValidForHabit(habit, checkInDate)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Check-in date is not valid for this habit frequency' 
      });
    }

    // Check if already checked in today
    const dateStr = formatDateString(checkInDate);
    if (habit.completedDates?.includes(dateStr) && completed) {
      return res.status(400).json({ 
        success: false, 
        message: 'Already checked in for this date' 
      });
    }

    // Create check-in
    const checkInData = createCheckInData(habitId, userId, {
      date: checkInDate,
      completed: completed !== false,
      completionPercentage: completionPercentage || (completed !== false ? 100 : 0),
      notes,
      photoUrl,
      mood
    });

    const checkInRef = await db.collection('checkins').add(checkInData);
    const checkIn = { id: checkInRef.id, ...checkInData };

    // Update streak if completed
    let streakResult = null;
    if (completed !== false) {
      streakResult = await updateStreak(habitId, userId, checkInDate);
      
      // Award XP and check achievements
      try {
        await addXP(userId, 10, 'check_in');
        await checkAchievements(userId, { type: 'check_in', habitId, streak: streakResult.currentStreak });
      } catch (achievementError) {
        console.warn('Achievement error (non-fatal):', achievementError);
      }
    }

    // Update user last activity
    await db.collection('users').doc(userId).update({
      lastActivity: new Date()
    });

    res.json({
      success: true,
      checkIn,
      streak: streakResult || { currentStreak: habit.streak, updated: false }
    });
  } catch (error) {
    console.error('Create check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create check-in',
      error: error.message
    });
  }
});

// Get check-ins for a habit
router.get('/habit/:habitId', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { habitId } = req.params;
    const userId = req.user.uid;
    const { limit = 50, startAfter } = req.query;

    // Verify habit belongs to user
    const habitDoc = await db.collection('habits').doc(habitId).get();
    if (!habitDoc.exists || habitDoc.data().userId !== userId) {
      return res.status(404).json({ success: false, message: 'Habit not found' });
    }

    let query = db.collection('checkins')
      .where('habitId', '==', habitId)
      .where('userId', '==', userId)
      .orderBy('date', 'desc')
      .limit(parseInt(limit));

    if (startAfter) {
      const startAfterDoc = await db.collection('checkins').doc(startAfter).get();
      query = query.startAfter(startAfterDoc);
    }

    const snapshot = await query.get();
    const checkIns = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      checkIns
    });
  } catch (error) {
    console.error('Get check-ins error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get check-ins',
      error: error.message
    });
  }
});

// Update check-in
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    const userId = req.user.uid;
    const updates = req.body;

    const checkInDoc = await db.collection('checkins').doc(id).get();
    if (!checkInDoc.exists) {
      return res.status(404).json({ success: false, message: 'Check-in not found' });
    }

    if (checkInDoc.data().userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await db.collection('checkins').doc(id).update({
      ...updates,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Check-in updated'
    });
  } catch (error) {
    console.error('Update check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update check-in',
      error: error.message
    });
  }
});

// Delete check-in
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    const userId = req.user.uid;

    const checkInDoc = await db.collection('checkins').doc(id).get();
    if (!checkInDoc.exists) {
      return res.status(404).json({ success: false, message: 'Check-in not found' });
    }

    if (checkInDoc.data().userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await db.collection('checkins').doc(id).delete();

    res.json({
      success: true,
      message: 'Check-in deleted'
    });
  } catch (error) {
    console.error('Delete check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete check-in',
      error: error.message
    });
  }
});

export default router;

