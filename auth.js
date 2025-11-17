import express from 'express';
import { getAuth, getFirestore } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    const db = getFirestore();
    const auth = getAuth();
    
    const { email, name, phone } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email and name are required'
      });
    }

    // Get user ID from the Firebase Auth token (user already created by frontend)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const uid = decodedToken.uid;

    // Check if user document already exists in Firestore
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      return res.status(400).json({
        success: false,
        message: 'User already registered'
      });
    }

    // Create user document in Firestore
    const userData = {
      name,
      email,
      phone: phone || '',
      goals: [],
      settings: {
        language: 'en',
        theme: 'light',
        notifications: true,
      },
      language: 'en',
      theme: 'light',
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    await db.collection('users').doc(uid).set(userData);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        uid,
        email,
        name,
        ...userData,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Registration failed',
    });
  }
});

// Login (Firebase handles this, but we can verify token)
router.post('/login', async (req, res) => {
  try {
    const db = getFirestore();
    const auth = getAuth();
    
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required'
      });
    }

    const decodedToken = await auth.verifyIdToken(idToken);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update last activity
    await db.collection('users').doc(decodedToken.uid).update({
      lastActivity: new Date(),
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        ...userDoc.data(),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token or login failed',
    });
  }
});

// Logout (mainly for server-side session management if needed)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    
    // Update last activity
    await db.collection('users').doc(req.user.uid).update({
      lastActivity: new Date(),
    });

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
});

export default router;



