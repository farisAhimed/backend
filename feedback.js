import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Rate AI
router.post('/rateAI', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { rating, comment, feature } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const feedbackData = {
      userId: req.user.uid,
      type: 'ai_rating',
      rating,
      comment: comment || '',
      feature: feature || 'general',
      createdAt: new Date(),
    };

    const feedbackRef = await db.collection('ai_feedback').add(feedbackData);

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedbackId: feedbackRef.id,
    });
  } catch (error) {
    console.error('Rate AI error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
    });
  }
});

// Report issue
router.post('/reportIssue', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { issueType, description, severity } = req.body;

    if (!issueType || !description) {
      return res.status(400).json({
        success: false,
        message: 'Issue type and description are required'
      });
    }

    const feedbackData = {
      userId: req.user.uid,
      type: 'issue_report',
      issueType,
      description,
      severity: severity || 'medium',
      status: 'open',
      createdAt: new Date(),
    };

    const feedbackRef = await db.collection('ai_feedback').add(feedbackData);

    res.status(201).json({
      success: true,
      message: 'Issue reported successfully',
      feedbackId: feedbackRef.id,
    });
  } catch (error) {
    console.error('Report issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report issue',
    });
  }
});

// Get all feedback (admin or own feedback)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db
      .collection('ai_feedback')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .get();

    const feedback = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({
      success: true,
      feedback,
    });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback',
    });
  }
});

export default router;



