import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';
import { createHabitData } from '../models/Habit.js';
import { sendStreakEndAlert } from '../services/fcmService.js';

const router = express.Router();

// Create habit
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const userId = req.user.uid;
    const habitData = req.body;

    if (!habitData.name || !habitData.category) {
      return res.status(400).json({
        success: false,
        message: 'Name and category are required'
      });
    }

    // Use the Habit model to create properly structured data
    const newHabit = createHabitData(userId, habitData);

    const habitRef = await db.collection('habits').add(newHabit);
    const habitDoc = await habitRef.get();

    res.status(201).json({
      success: true,
      message: 'Habit created successfully',
      habit: {
        id: habitRef.id,
        ...habitDoc.data(),
      },
    });
  } catch (error) {
    console.error('Create habit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create habit',
      error: error.message
    });
  }
});

// Get all habits for user
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { archived, status, category } = req.query;
    
    // Start with base query - get all habits for user
    let query = db.collection('habits').where('userId', '==', req.user.uid);

    // Note: Firestore requires composite indexes for multiple where clauses on different fields
    // For now, we'll fetch all and filter in memory to avoid index requirements
    const snapshot = await query.get();
    
    console.log(`Found ${snapshot.size} habits for user ${req.user.uid}`); // Debug log
    
    let habits = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings for frontend
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        startDate: data.startDate?.toDate?.()?.toISOString() || data.startDate,
        endDate: data.endDate?.toDate?.()?.toISOString() || data.endDate,
      };
    });

    // Filter in memory (more flexible, works without composite indexes)
    if (archived === 'false' || !archived) {
      habits = habits.filter(h => !h.archived);
    } else if (archived === 'true') {
      habits = habits.filter(h => h.archived === true);
    }

    if (status) {
      habits = habits.filter(h => h.status === status);
    }

    if (category) {
      habits = habits.filter(h => h.category === category);
    }

    console.log(`Returning ${habits.length} habits after filtering`); // Debug log

    res.json({
      success: true,
      habits,
    });
  } catch (error) {
    console.error('Get habits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch habits',
      error: error.message
    });
  }
});

// Get single habit
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const habitDoc = await db.collection('habits').doc(req.params.id).get();

    if (!habitDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    const habit = habitDoc.data();

    if (habit.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    res.json({
      success: true,
      habit: {
        id: habitDoc.id,
        ...habit,
      },
    });
  } catch (error) {
    console.error('Get habit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch habit',
    });
  }
});

// Update habit
router.patch('/:id/update', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const habitRef = db.collection('habits').doc(req.params.id);
    const habitDoc = await habitRef.get();

    if (!habitDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    const habit = habitDoc.data();
    if (habit.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { name, category, frequency, schedule } = req.body;
    const updateData = { updatedAt: new Date() };

    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (frequency) updateData.frequency = frequency;
    if (schedule) updateData.schedule = schedule;

    await habitRef.update(updateData);
    const updatedDoc = await habitRef.get();

    res.json({
      success: true,
      message: 'Habit updated successfully',
      habit: {
        id: habitRef.id,
        ...updatedDoc.data(),
      },
    });
  } catch (error) {
    console.error('Update habit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update habit',
    });
  }
});

// Pause habit
router.patch('/:id/pause', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const habitRef = db.collection('habits').doc(req.params.id);
    const habitDoc = await habitRef.get();

    if (!habitDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    const habit = habitDoc.data();
    if (habit.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    await habitRef.update({
      paused: !habit.paused,
      updatedAt: new Date(),
    });

    const updatedDoc = await habitRef.get();

    res.json({
      success: true,
      message: `Habit ${updatedDoc.data().paused ? 'paused' : 'resumed'} successfully`,
      habit: {
        id: habitRef.id,
        ...updatedDoc.data(),
      },
    });
  } catch (error) {
    console.error('Pause habit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pause/resume habit',
    });
  }
});

// Archive habit
router.patch('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const habitRef = db.collection('habits').doc(req.params.id);
    const habitDoc = await habitRef.get();

    if (!habitDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    const habit = habitDoc.data();
    if (habit.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    await habitRef.update({
      archived: true,
      paused: true,
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Habit archived successfully',
    });
  } catch (error) {
    console.error('Archive habit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive habit',
    });
  }
});

// Check in habit
router.post('/:id/checkIn', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const habitRef = db.collection('habits').doc(req.params.id);
    const habitDoc = await habitRef.get();

    if (!habitDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    const habit = habitDoc.data();
    if (habit.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    if (habit.archived || habit.paused) {
      return res.status(400).json({
        success: false,
        message: 'Cannot check in to archived or paused habit'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const completedDates = habit.completedDates || [];
    const previousStreak = habit.streak || 0;

    // Check if already checked in today
    if (completedDates.includes(today)) {
      return res.status(400).json({
        success: false,
        message: 'Already checked in today'
      });
    }

    // Calculate new streak
    let newStreak = 1;
    if (completedDates.length > 0) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (completedDates.includes(yesterdayStr)) {
        newStreak = previousStreak + 1;
      } else if (previousStreak > 0) {
        // Streak broken - send notification
        await sendStreakEndAlert(req.user.uid, habit.name, previousStreak);
      }
    }

    // Add today's date
    completedDates.push(today);

    await habitRef.update({
      completedDates,
      streak: newStreak,
      updatedAt: new Date(),
      lastCheckIn: new Date(),
    });

    // Update user's last activity (only if user document exists)
    try {
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      if (userDoc.exists) {
        await db.collection('users').doc(req.user.uid).update({
          lastActivity: new Date(),
        });
      }
    } catch (userUpdateError) {
      // Log but don't fail the check-in if user update fails
      console.warn('Failed to update user lastActivity:', userUpdateError.message);
    }

    const updatedDoc = await habitRef.get();

    res.json({
      success: true,
      message: 'Check-in successful',
      habit: {
        id: habitRef.id,
        ...updatedDoc.data(),
      },
      streak: newStreak,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check in',
    });
  }
});

export default router;



