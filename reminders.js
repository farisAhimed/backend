import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Create reminder
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { habitId, time, aiOptimizedWindow } = req.body;

    if (!habitId || !time) {
      return res.status(400).json({
        success: false,
        message: 'Habit ID and time are required'
      });
    }

    // Verify habit belongs to user
    const habitDoc = await db.collection('habits').doc(habitId).get();
    if (!habitDoc.exists || habitDoc.data().userId !== req.user.uid) {
      return res.status(404).json({
        success: false,
        message: 'Habit not found'
      });
    }

    const reminderData = {
      userId: req.user.uid,
      habitId,
      time: new Date(time),
      aiOptimizedWindow: aiOptimizedWindow || null,
      status: 'active',
      createdAt: new Date(),
    };

    const reminderRef = await db.collection('reminders').add(reminderData);
    const reminderDoc = await reminderRef.get();

    res.status(201).json({
      success: true,
      message: 'Reminder created successfully',
      reminder: {
        id: reminderRef.id,
        ...reminderDoc.data(),
      },
    });
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create reminder',
    });
  }
});

// Get all reminders for user
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('reminders')
      .where('userId', '==', req.user.uid)
      .get();

    const reminders = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      reminders,
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminders',
    });
  }
});

// Update reminder
router.patch('/:id/update', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const reminderRef = db.collection('reminders').doc(req.params.id);
    const reminderDoc = await reminderRef.get();

    if (!reminderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    const reminder = reminderDoc.data();
    if (reminder.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { time, aiOptimizedWindow, status } = req.body;
    const updateData = { updatedAt: new Date() };

    if (time) updateData.time = new Date(time);
    if (aiOptimizedWindow !== undefined) updateData.aiOptimizedWindow = aiOptimizedWindow;
    if (status) updateData.status = status;

    await reminderRef.update(updateData);
    const updatedDoc = await reminderRef.get();

    res.json({
      success: true,
      message: 'Reminder updated successfully',
      reminder: {
        id: reminderRef.id,
        ...updatedDoc.data(),
      },
    });
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reminder',
    });
  }
});

// Delete reminder
router.delete('/:id/delete', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const reminderRef = db.collection('reminders').doc(req.params.id);
    const reminderDoc = await reminderRef.get();

    if (!reminderDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    const reminder = reminderDoc.data();
    if (reminder.userId !== req.user.uid) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    await reminderRef.delete();

    res.json({
      success: true,
      message: 'Reminder deleted successfully',
    });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete reminder',
    });
  }
});

export default router;



