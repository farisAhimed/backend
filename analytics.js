import express from 'express';
import { getFirestore } from '../config/firebase.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get daily analytics
router.get('/daily', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Fetch all habits for user (filter archived in memory)
    const habitsSnapshot = await db
      .collection('habits')
      .where('userId', '==', req.user.uid)
      .get();

    let habits = habitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter out archived habits
    habits = habits.filter(h => !h.archived);

    console.log(`Daily analytics: Found ${habits.length} active habits for user ${req.user.uid}`);

    const totalHabits = habits.length;
    const completedHabits = habits.filter(habit => 
      habit.completedDates?.includes(dateStr)
    ).length;
    const completionRate = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0;

    res.json({
      success: true,
      analytics: {
        date: dateStr,
        totalHabits,
        completedHabits,
        completionRate: Math.round(completionRate * 100) / 100,
        habits: habits.map(habit => ({
          id: habit.id,
          name: habit.name,
          category: habit.category,
          completed: habit.completedDates?.includes(dateStr) || false,
          streak: habit.streak,
        })),
      },
    });
  } catch (error) {
    console.error('Get daily analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily analytics',
    });
  }
});

// Get weekly analytics
router.get('/weekly', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { startDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      weekDates.push(date.toISOString().split('T')[0]);
    }

    // Fetch all habits for user (filter archived in memory)
    const habitsSnapshot = await db
      .collection('habits')
      .where('userId', '==', req.user.uid)
      .get();

    let habits = habitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter out archived habits
    habits = habits.filter(h => !h.archived);

    console.log(`Weekly analytics: Found ${habits.length} active habits for user ${req.user.uid}`);

    const weeklyData = weekDates.map(dateStr => {
      const completedHabits = habits.filter(habit =>
        habit.completedDates?.includes(dateStr)
      ).length;
      return {
        date: dateStr,
        completed: completedHabits,
        total: habits.length,
      };
    });

    const totalCompletions = weeklyData.reduce((sum, day) => sum + day.completed, 0);
    const averageDaily = habits.length > 0 ? totalCompletions / 7 : 0;

    res.json({
      success: true,
      analytics: {
        weekStart: weekDates[0],
        weekEnd: weekDates[6],
        dailyData: weeklyData,
        totalCompletions,
        averageDaily: Math.round(averageDaily * 100) / 100,
        totalHabits: habits.length,
      },
    });
  } catch (error) {
    console.error('Get weekly analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly analytics',
    });
  }
});

// Get monthly analytics
router.get('/monthly', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const { year, month } = req.query;
    const targetDate = year && month 
      ? new Date(year, month - 1, 1)
      : new Date();
    
    const yearNum = targetDate.getFullYear();
    const monthNum = targetDate.getMonth();

    const startDate = new Date(yearNum, monthNum, 1);
    const endDate = new Date(yearNum, monthNum + 1, 0);

    // Fetch all habits for user (filter archived in memory)
    const habitsSnapshot = await db
      .collection('habits')
      .where('userId', '==', req.user.uid)
      .get();

    let habits = habitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter out archived habits
    habits = habits.filter(h => !h.archived);

    console.log(`Monthly analytics: Found ${habits.length} active habits for user ${req.user.uid}`);

    const monthlyData = [];
    for (let day = 1; day <= endDate.getDate(); day++) {
      const date = new Date(yearNum, monthNum, day);
      const dateStr = date.toISOString().split('T')[0];
      const completedHabits = habits.filter(habit =>
        habit.completedDates?.includes(dateStr)
      ).length;
      
      monthlyData.push({
        date: dateStr,
        day,
        completed: completedHabits,
        total: habits.length,
      });
    }

    const totalCompletions = monthlyData.reduce((sum, day) => sum + day.completed, 0);
    const averageDaily = habits.length > 0 ? totalCompletions / endDate.getDate() : 0;
    const completionRate = habits.length > 0 
      ? (totalCompletions / (habits.length * endDate.getDate())) * 100 
      : 0;

    res.json({
      success: true,
      analytics: {
        year: yearNum,
        month: monthNum + 1,
        monthName: targetDate.toLocaleString('default', { month: 'long' }),
        dailyData: monthlyData,
        totalCompletions,
        averageDaily: Math.round(averageDaily * 100) / 100,
        completionRate: Math.round(completionRate * 100) / 100,
        totalHabits: habits.length,
      },
    });
  } catch (error) {
    console.error('Get monthly analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly analytics',
    });
  }
});

// Get category breakdown
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    // Fetch all habits for user (filter archived in memory)
    const habitsSnapshot = await db
      .collection('habits')
      .where('userId', '==', req.user.uid)
      .get();

    let habits = habitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Filter out archived habits
    habits = habits.filter(h => !h.archived);

    console.log(`Category analytics: Found ${habits.length} active habits for user ${req.user.uid}`);

    const categoryStats = {};
    habits.forEach(habit => {
      const category = habit.category || 'Uncategorized';
      if (!categoryStats[category]) {
        categoryStats[category] = {
          category,
          totalHabits: 0,
          totalStreak: 0,
          totalCompletions: 0,
        };
      }
      categoryStats[category].totalHabits++;
      categoryStats[category].totalStreak += habit.streak || 0;
      categoryStats[category].totalCompletions += habit.completedDates?.length || 0;
    });

    const categories = Object.values(categoryStats).map(stat => ({
      ...stat,
      averageStreak: stat.totalHabits > 0 
        ? Math.round((stat.totalStreak / stat.totalHabits) * 100) / 100 
        : 0,
    }));

    res.json({
      success: true,
      analytics: {
        categories,
        totalCategories: categories.length,
      },
    });
  } catch (error) {
    console.error('Get category analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category analytics',
    });
  }
});

export default router;



