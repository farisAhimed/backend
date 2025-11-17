/**
 * Notification Routes
 * Handles user notifications
 */

import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { limit = 50, unreadOnly = false } = req.query;
    
    let query = db.collection('notifications')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));
    
    if (unreadOnly === 'true') {
      query = query.where('read', '==', false);
    }
    
    const snapshot = await query.get();
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
      error: error.message
    });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    
    const notificationDoc = await db.collection('notifications').doc(id).get();
    if (!notificationDoc.exists) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    if (notificationDoc.data().userId !== req.user.uid) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    await db.collection('notifications').doc(id).update({
      read: true
    });
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    
    const snapshot = await db.collection('notifications')
      .where('userId', '==', req.user.uid)
      .where('read', '==', false)
      .get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });
    
    await batch.commit();
    
    res.json({
      success: true,
      message: `Marked ${snapshot.size} notifications as read`
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { id } = req.params;
    
    const notificationDoc = await db.collection('notifications').doc(id).get();
    if (!notificationDoc.exists) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    if (notificationDoc.data().userId !== req.user.uid) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    
    await db.collection('notifications').doc(id).delete();
    
    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

export default router;


