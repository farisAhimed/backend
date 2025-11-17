/**
 * Upload Routes
 * Handles file uploads (photos for check-ins)
 */

import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';
import admin from 'firebase-admin';

const router = express.Router();

// Upload photo for check-in
router.post('/photo', authenticateToken, async (req, res) => {
  try {
    const { base64Image, fileName, habitId } = req.body;
    const userId = req.user.uid;
    
    if (!base64Image) {
      return res.status(400).json({
        success: false,
        message: 'No image provided'
      });
    }
    
    // Convert base64 to buffer
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Generate file path
    const timestamp = Date.now();
    const fileExtension = fileName?.split('.').pop() || 'jpg';
    const filePath = `checkins/${userId}/${habitId || 'general'}/${timestamp}.${fileExtension}`;
    
    // Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);
    
    await file.save(imageBuffer, {
      metadata: {
        contentType: `image/${fileExtension}`,
        metadata: {
          userId,
          habitId: habitId || null,
          uploadedAt: new Date().toISOString()
        }
      }
    });
    
    // Make file publicly accessible
    await file.makePublic();
    
    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    
    res.json({
      success: true,
      photoUrl: publicUrl,
      filePath
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload photo',
      error: error.message
    });
  }
});

// Delete photo
router.delete('/photo/:filePath', authenticateToken, async (req, res) => {
  try {
    const { filePath } = req.params;
    const userId = req.user.uid;
    
    // Verify file belongs to user
    if (!filePath.startsWith(`checkins/${userId}/`)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }
    
    // Delete from Firebase Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);
    
    await file.delete();
    
    res.json({
      success: true,
      message: 'Photo deleted'
    });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete photo',
      error: error.message
    });
  }
});

export default router;

