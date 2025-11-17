import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(req.user.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        uid: req.user.uid,
        ...userDoc.data(),
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
    });
  }
});

// Update user profile
router.patch('/update', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { name, phone, goals, settings, language, theme, fcmToken } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (goals) updateData.goals = goals;
    if (settings) updateData.settings = settings;
    if (language) {
      updateData.language = language;
      updateData.settings = { ...updateData.settings, language };
    }
    if (theme) {
      updateData.theme = theme;
      updateData.settings = { ...updateData.settings, theme };
    }
    if (fcmToken) updateData.fcmToken = fcmToken;

    updateData.updatedAt = new Date();

    await db.collection('users').doc(req.user.uid).update(updateData);

    const updatedDoc = await db.collection('users').doc(req.user.uid).get();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        uid: req.user.uid,
        ...updatedDoc.data(),
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
});

// Deactivate user account
router.delete('/deactivate', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    // Archive all user's habits
    const habitsSnapshot = await db
      .collection('habits')
      .where('userId', '==', req.user.uid)
      .get();

    const batch = db.batch();
    habitsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { archived: true, paused: true });
    });
    await batch.commit();

    // Update user status
    await db.collection('users').doc(req.user.uid).update({
      deactivated: true,
      deactivatedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Account deactivated successfully',
    });
  } catch (error) {
    console.error('Deactivate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate account',
    });
  }
});

export default router;



