/**
 * Gemini AI Service for GrowTrack Habit Tracking
 * 
 * This service provides advanced AI-powered features for habit tracking:
 * 1. Habit Brain Twin (HB-Twin) - Predictions and behavioral insights
 * 2. Adaptive Difficulty Engine - Dynamic difficulty adjustment
 * 3. Emotion-Aware Motivation Engine - Sentiment analysis and adaptive messages
 * 4. AI Habit Builder Wizard - Goal to habit plan generation
 * 5. AI Social Accountability Swarm - Multiple AI personas
 * 6. Habit Failure Post-Mortem Report - Failure analysis
 * 7. Life Dashboard Analytics - AI summaries and projections
 * 8. Habit Stacking Engine - Generate supportive micro-habits
 * 9. Focus Bubble Mode - Dynamic encouragement
 * 10. Gemini Auto-Journal - Expand entries into full journals
 */

import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const apiKey = process.env.AI_API_KEY || process.env.GEMINI_API_KEY ||"AIzaSyBdatcZbd8acYWhliBza8IC9-XSxRgYcx8";
let modelName = process.env.AI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Validate and fix model name if needed
if (!modelName.startsWith('gemini')) {
  console.warn('⚠️ Invalid model name, switching to gemini-1.5-flash');
  modelName = 'gemini-1.5-flash';
}

// Fallback models if the default doesn't work
const fallbackModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-2.0-flash-exp'];

if (apiKey) {
  console.log(`✅ Gemini AI configured with model: ${modelName}`);
} else {
  console.warn('⚠️ AI API key not configured. AI features will use fallback responses.');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sleep utility for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Clean up JSON response (remove markdown code blocks if present)
 */
function cleanupJSON(text) {
  return text
    .replace(/```json/i, '')
    .replace(/```/g, '')
    .trim();
}

/**
 * Safe JSON parser with error handling
 */
function safeJSON(text) {
  try {
    const cleaned = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('❌ JSON parse failed. Raw text preview:', text.substring(0, 500));
    throw new Error('AI returned invalid JSON. Try again.');
  }
}

/**
 * Parse JSON with retry and repair attempts
 */
function parseJSONWithRetry(jsonString, useJSONMode = true) {
  if (useJSONMode) {
    try {
      return safeJSON(jsonString);
    } catch (error) {
      console.warn('⚠️ JSON mode parse failed, trying fallback...');
    }
  }

  try {
    return safeJSON(jsonString);
  } catch (error) {
    console.warn('⚠️ Direct parse failed, attempting repair...');
  }

  try {
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (repairError) {
    console.error('❌ All JSON parsing attempts failed:', repairError.message);
    throw new Error('Failed to parse AI response as JSON. Please try again.');
  }
}

// ============================================================================
// CORE GEMINI API CALL FUNCTION
// ============================================================================

/**
 * Universal Gemini API call function with retry logic and rate limit handling
 * 
 * @param {string} prompt - The prompt to send to the AI
 * @param {string} systemPrompt - Optional system prompt for context
 * @param {number} timeout - Request timeout in milliseconds (default: 90000)
 * @param {boolean} expectJSON - Whether to expect JSON response (default: false)
 * @param {number} retries - Number of retry attempts (default: 2)
 * @returns {Promise<string>} - AI response text
 */
export async function callGemini(
  prompt,
  systemPrompt = '',
  timeout = 90000,
  expectJSON = false,
  retries = 2
) {
  try {
    if (!apiKey) {
      throw new Error('AI API key is not configured. Please set AI_API_KEY or GEMINI_API_KEY in your .env file');
    }

    const url = `${BASE_URL}/${modelName}:generateContent?key=${apiKey}`;
    
    // Combine system prompt and user prompt
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: fullPrompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        // Force JSON response when needed
        ...(expectJSON && { response_mime_type: 'application/json' }),
      }
    };
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: { message: errorText } };
          }
          
          // Handle rate limiting (429)
          if (response.status === 429) {
            const retryInfo = errorData.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
            const retryDelay = retryInfo?.retryDelay;
            const delayMs = retryDelay ? parseFloat(retryDelay.replace('s', '')) * 1000 : (attempt + 1) * 5000;
            
            if (attempt < retries) {
              console.warn(`⚠️ Rate limit hit. Retrying after ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${retries})`);
              await sleep(delayMs);
              continue;
            } else {
              throw new Error('AI service is currently rate-limited. Please try again later.');
            }
          }

          // Handle 404 (model not found) - try fallback model
          if (response.status === 404) {
            if (attempt < retries && fallbackModels.length > 0) {
              const fallbackModel = fallbackModels.find(m => m !== modelName);
              if (fallbackModel) {
                console.warn(`⚠️ Model ${modelName} not found. Trying fallback: ${fallbackModel}`);
                modelName = fallbackModel;
                continue;
              }
            }
          }
          
          throw new Error(`AI API request failed: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        
        // Check for safety ratings
        const candidate = data?.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const safetyRatings = candidate?.safetyRatings || [];
        const blockedCategories = safetyRatings
          .filter(rating => rating.probability === 'HIGH' || rating.probability === 'MEDIUM')
          .map(rating => rating.category)
          .filter(Boolean);

        if (finishReason === 'SAFETY' || blockedCategories.length > 0) {
          throw new Error(
            `Response was blocked by safety filters. Categories: ${blockedCategories.join(', ') || 'unknown'}. Please rephrase your question.`
          );
        }

        if (finishReason === 'MAX_TOKENS') {
          console.warn('⚠️ Response may be truncated due to token limit');
        }
        
        if (candidate?.content?.parts) {
          const textParts = candidate.content.parts
            .filter(part => part.text)
            .map(part => part.text);
          
          const text = textParts.join('');
          
          if (!text.trim()) {
            throw new Error(
              `Empty AI response. Finish reason: ${finishReason || 'unknown'}. This might be due to content filtering or an API issue.`
            );
          }

          // If not JSON mode, clean up markdown code blocks
          if (!expectJSON) {
            return cleanupJSON(text);
          }

          return text.trim();
        } else {
          throw new Error('Unexpected response format from AI API');
        }
      } catch (fetchError) {
        // Handle timeout errors
        if (fetchError.name === 'AbortError' || fetchError.message.includes('timeout')) {
          console.error(`❌ Gemini API request timed out after ${timeout}ms`);
          throw new Error(
            `AI request timed out after ${Math.round(timeout / 1000)} seconds. Please try again or simplify the request.`
          );
        }

        // If it's the last attempt or not a retryable error, throw
        if (attempt === retries || (!fetchError.message.includes('rate') && !fetchError.message.includes('429'))) {
          throw fetchError;
        }
        // Otherwise, wait and retry
        await sleep((attempt + 1) * 2000);
      }
    }
  } catch (error) {
    console.error('AI Service Error:', error.message);
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

// ============================================================================
// 1. HABIT BRAIN TWIN (HB-Twin) - Predictions & Behavioral Insights
// ============================================================================

/**
 * Predict habit consistency, risk of drop, and future projections
 * 
 * @param {string} userId - User ID
 * @param {Array} habits - User's habits with history
 * @param {Object} engagementData - Engagement frequency and patterns
 * @returns {Promise<Object>} - Predictions, simulations, and behavioral insights
 */
export async function predictHabitBrainTwin(userId, habits, engagementData) {
  try {
    const systemPrompt = 'You are an expert behavioral psychologist and data scientist specializing in habit formation. Always respond with valid JSON only.';

    const prompt = `Analyze the following habit tracking data and provide comprehensive predictions and behavioral insights.

**User Habits:**
${JSON.stringify(habits, null, 2)}

**Engagement Data:**
${JSON.stringify(engagementData, null, 2)}

**Required Analysis (JSON format only - no markdown, no code blocks):**
{
  "consistencyScore": 0-100,
  "riskAssessment": {
    "highRiskHabits": [
      {
        "habitId": "habit_id",
        "habitName": "name",
        "riskLevel": "high|medium|low",
        "riskFactors": ["factor1", "factor2"],
        "dropProbability": 0-100
      }
    ],
    "overallRisk": "high|medium|low"
  },
  "futureProjections": {
    "next7Days": {
      "expectedCompletions": 0-7,
      "confidence": 0-100
    },
    "next30Days": {
      "expectedCompletions": 0-30,
      "confidence": 0-100
    },
    "streakProjections": [
      {
        "habitId": "habit_id",
        "currentStreak": 5,
        "projectedStreak30Days": 25,
        "confidence": 0-100
      }
    ]
  },
  "behavioralInsights": {
    "patterns": ["insight1", "insight2", "insight3"],
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"],
    "recommendations": ["recommendation1", "recommendation2"]
  },
  "simulations": {
    "bestCase": "Description of best case scenario",
    "worstCase": "Description of worst case scenario",
    "mostLikely": "Description of most likely scenario"
  }
}

Provide detailed, actionable insights based on the data.`;

    const responseText = await callGemini(prompt, systemPrompt, 90000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn('HB-Twin prediction failed, using fallback:', error.message);
    return {
      consistencyScore: 70,
      riskAssessment: {
        highRiskHabits: [],
        overallRisk: 'medium'
      },
      futureProjections: {
        next7Days: { expectedCompletions: 5, confidence: 60 },
        next30Days: { expectedCompletions: 20, confidence: 50 }
      },
      behavioralInsights: {
        patterns: ['Continue tracking to identify patterns'],
        strengths: ['Consistent tracking'],
        weaknesses: ['Irregular check-ins'],
        recommendations: ['Set reminders', 'Track at consistent times']
      },
      simulations: {
        bestCase: 'Maintain all current streaks',
        worstCase: 'Some habits may be dropped',
        mostLikely: 'Gradual improvement with occasional setbacks'
      }
    };
  }
}

// ============================================================================
// 2. ADAPTIVE DIFFICULTY ENGINE
// ============================================================================

/**
 * Analyze user performance and recommend difficulty adjustments
 * 
 * @param {string} userId - User ID
 * @param {Object} habit - Habit data with performance metrics
 * @param {Array} performanceHistory - Historical performance data
 * @returns {Promise<Object>} - Difficulty recommendations and adjustments
 */
export async function analyzeAdaptiveDifficulty(userId, habit, performanceHistory) {
  try {
    const systemPrompt = 'You are an expert in adaptive learning and habit difficulty scaling. Always respond with valid JSON only.';

    const prompt = `Analyze the following habit performance and recommend difficulty adjustments.

**Habit:**
${JSON.stringify(habit, null, 2)}

**Performance History:**
${JSON.stringify(performanceHistory, null, 2)}

**Required Analysis (JSON format only):**
{
  "currentDifficulty": "easy|medium|hard",
  "recommendedDifficulty": "easy|medium|hard",
  "adjustmentReason": "Why this adjustment is recommended",
  "performanceMetrics": {
    "completionRate": 0-100,
    "consistencyScore": 0-100,
    "trend": "improving|stable|declining"
  },
  "recommendations": {
    "upgrade": {
      "shouldUpgrade": true|false,
      "newDifficulty": "medium|hard",
      "reason": "Why upgrade",
      "suggestedChanges": ["change1", "change2"]
    },
    "downgrade": {
      "shouldDowngrade": true|false,
      "newDifficulty": "easy|medium",
      "reason": "Why downgrade",
      "suggestedChanges": ["change1", "change2"]
    }
  },
  "actionItems": ["action1", "action2", "action3"]
}

Provide specific, actionable recommendations.`;

    const responseText = await callGemini(prompt, systemPrompt, 90000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn('Adaptive difficulty analysis failed, using fallback:', error.message);
    return {
      currentDifficulty: habit.difficulty || 'medium',
      recommendedDifficulty: habit.difficulty || 'medium',
      adjustmentReason: 'Maintain current difficulty based on performance',
      performanceMetrics: {
        completionRate: 70,
        consistencyScore: 65,
        trend: 'stable'
      },
      recommendations: {
        upgrade: { shouldUpgrade: false, newDifficulty: null, reason: '', suggestedChanges: [] },
        downgrade: { shouldDowngrade: false, newDifficulty: null, reason: '', suggestedChanges: [] }
      },
      actionItems: ['Continue tracking', 'Maintain consistency']
    };
  }
}

// ============================================================================
// 3. EMOTION-AWARE MOTIVATION ENGINE
// ============================================================================

/**
 * Analyze sentiment from text/voice check-ins and generate adaptive motivational messages
 * 
 * @param {string} userId - User ID
 * @param {string} checkInText - User's check-in text or transcribed voice
 * @param {Object} context - Additional context (streak, recent activity, etc.)
 * @param {string} tonePreference - Preferred tone (encouraging, empathetic, energetic, calm)
 * @returns {Promise<Object>} - Sentiment analysis and adaptive motivational message
 */
export async function generateEmotionAwareMotivation(userId, checkInText, context = {}, tonePreference = 'encouraging') {
  try {
    const systemPrompt = 'You are an expert in emotional intelligence and motivational psychology. Analyze sentiment and generate adaptive motivational messages. Always respond with valid JSON only.';

    const prompt = `Analyze the sentiment of this user check-in and generate an adaptive motivational message.

**Check-in Text:**
"${checkInText}"

**Context:**
${JSON.stringify(context, null, 2)}

**Tone Preference:** ${tonePreference}

**Required Analysis (JSON format only):**
{
  "sentiment": {
    "overall": "positive|neutral|negative|mixed",
    "emotions": ["emotion1", "emotion2"],
    "confidence": 0-100,
    "keyPhrases": ["phrase1", "phrase2"]
  },
  "motivationalMessage": {
    "message": "Personalized motivational message (2-3 sentences)",
    "tone": "${tonePreference}",
    "length": "short|medium|long"
  },
  "recommendations": {
    "immediateActions": ["action1", "action2"],
    "supportNeeded": true|false,
    "supportType": "encouragement|guidance|celebration|reflection"
  },
  "adaptiveSuggestions": [
    "suggestion1",
    "suggestion2"
  ]
}

Be empathetic, understanding, and adapt the message tone based on the detected sentiment.`;

    const responseText = await callGemini(prompt, systemPrompt, 90000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn('Emotion-aware motivation failed, using fallback:', error.message);
    return {
      sentiment: {
        overall: 'neutral',
        emotions: ['determined'],
        confidence: 50,
        keyPhrases: []
      },
      motivationalMessage: {
        message: 'Keep up the great work! Every check-in brings you closer to your goals.',
        tone: tonePreference,
        length: 'short'
      },
      recommendations: {
        immediateActions: ['Continue tracking'],
        supportNeeded: false,
        supportType: 'encouragement'
      },
      adaptiveSuggestions: ['Stay consistent', 'Celebrate small wins']
    };
  }
}

// ============================================================================
// 4. AI HABIT BUILDER WIZARD
// ============================================================================

/**
 * Generate a complete habit plan from a user goal
 * 
 * @param {string} userId - User ID
 * @param {string} goal - User's goal description
 * @param {Object} userPreferences - User preferences (schedule, difficulty, etc.)
 * @returns {Promise<Object>} - Complete habit plan with schedule, milestones, and micro-habits
 */
export async function generateHabitBuilderPlan(userId, goal, userPreferences = {}) {
  try {
    const systemPrompt = 'You are an expert habit formation coach and planner. Create comprehensive, actionable habit plans. Always respond with valid JSON only.';

    const prompt = `Create a comprehensive habit plan to achieve this goal: "${goal}"

**User Preferences:**
${JSON.stringify(userPreferences, null, 2)}

**Required Plan (JSON format only):**
{
  "goal": "${goal}",
  "planOverview": "Brief overview of the plan (2-3 sentences)",
  "mainHabits": [
    {
      "name": "Habit name",
      "description": "Description",
      "category": "Health & Fitness|Productivity|Learning|Mindfulness|Personal Development|Other",
      "difficulty": "easy|medium|hard",
      "frequency": "daily|weekly",
      "estimatedTime": "Time per session",
      "priority": "high|medium|low"
    }
  ],
  "microHabits": [
    {
      "name": "Micro-habit name",
      "description": "Small, easy action",
      "parentHabit": "Main habit it supports",
      "difficulty": "easy",
      "estimatedTime": "1-5 minutes"
    }
  ],
  "schedule": {
    "recommendedTimes": ["morning", "afternoon", "evening"],
    "weeklyPlan": {
      "monday": ["habit1", "habit2"],
      "tuesday": ["habit1", "habit2"],
      "wednesday": ["habit1", "habit2"],
      "thursday": ["habit1", "habit2"],
      "friday": ["habit1", "habit2"],
      "saturday": ["habit1", "habit2"],
      "sunday": ["habit1", "habit2"]
    }
  },
  "milestones": [
    {
      "id": 1,
      "name": "Milestone name",
      "description": "What to achieve",
      "targetDate": "Days from start",
      "successCriteria": ["criterion1", "criterion2"]
    }
  ],
  "timeline": {
    "phase1": {
      "duration": "1-2 weeks",
      "focus": "Building foundation",
      "habits": ["habit1", "habit2"]
    },
    "phase2": {
      "duration": "2-4 weeks",
      "focus": "Expanding and strengthening",
      "habits": ["habit1", "habit2", "habit3"]
    },
    "phase3": {
      "duration": "4+ weeks",
      "focus": "Mastery and optimization",
      "habits": ["all habits"]
    }
  },
  "successTips": ["tip1", "tip2", "tip3", "tip4", "tip5"]
}

Create a realistic, achievable plan with clear milestones and actionable steps.`;

    const responseText = await callGemini(prompt, systemPrompt, 120000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn('Habit builder plan generation failed, using fallback:', error.message);
    return {
      goal,
      planOverview: `A structured plan to achieve: ${goal}`,
      mainHabits: [],
      microHabits: [],
      schedule: { recommendedTimes: [], weeklyPlan: {} },
      milestones: [],
      timeline: {},
      successTips: ['Start small', 'Be consistent', 'Track progress', 'Celebrate wins', 'Adjust as needed']
    };
  }
}

// ============================================================================
// 5. AI SOCIAL ACCOUNTABILITY SWARM
// ============================================================================

/**
 * Generate message from a specific AI persona
 * 
 * @param {string} persona - Persona type (mentor, hype-friend, calm-coach)
 * @param {string} context - Context for the message
 * @param {Object} userData - User's current state and data
 * @returns {Promise<Object>} - Persona message with tone and style
 */
export async function generatePersonaMessage(persona, context, userData = {}) {
  try {
    const personaPresets = {
      mentor: {
        tone: 'wise, experienced, supportive',
        style: 'professional, encouraging, provides guidance and wisdom',
        examples: 'Uses metaphors, shares insights, focuses on long-term growth'
      },
      'hype-friend': {
        tone: 'energetic, enthusiastic, celebratory',
        style: 'casual, excited, uses emojis and exclamation marks',
        examples: 'Celebrates wins, provides energy, keeps things fun'
      },
      'calm-coach': {
        tone: 'calm, reassuring, patient',
        style: 'gentle, understanding, focuses on mindfulness and balance',
        examples: 'Provides perspective, reduces anxiety, emphasizes self-compassion'
      }
    };

    const preset = personaPresets[persona] || personaPresets.mentor;

    const systemPrompt = `You are an AI ${persona} persona. Your tone is ${preset.tone}. Your style is ${preset.style}. ${preset.examples}. Always respond with valid JSON only.`;

    const prompt = `Generate a message as a ${persona} persona.

**Context:**
${context}

**User Data:**
${JSON.stringify(userData, null, 2)}

**Required Response (JSON format only):**
{
  "persona": "${persona}",
  "message": "Personalized message in the ${persona} style (2-4 sentences)",
  "tone": "${preset.tone}",
  "emojis": ["emoji1", "emoji2"] or [],
  "actionItems": ["action1", "action2"] or [],
  "encouragementLevel": "high|medium|low"
}

Make the message authentic to the ${persona} persona style.`;

    const responseText = await callGemini(prompt, systemPrompt, 60000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn(`Persona message generation failed for ${persona}, using fallback:`, error.message);
    return {
      persona,
      message: 'Keep going! You\'re doing great.',
      tone: 'encouraging',
      emojis: ['💪'],
      actionItems: [],
      encouragementLevel: 'medium'
    };
  }
}

// ============================================================================
// 6. HABIT FAILURE POST-MORTEM REPORT
// ============================================================================

/**
 * Generate failure analysis when a streak resets
 * 
 * @param {string} userId - User ID
 * @param {Object} habit - Habit that failed
 * @param {Object} failureContext - Context around the failure
 * @returns {Promise<Object>} - Failure analysis and recommendations
 */
export async function generateFailurePostMortem(userId, habit, failureContext = {}) {
  try {
    const systemPrompt = 'You are an expert in failure analysis and habit recovery. Be empathetic, constructive, and actionable. Always respond with valid JSON only.';

    const prompt = `Analyze this habit failure and provide a constructive post-mortem report.

**Habit:**
${JSON.stringify(habit, null, 2)}

**Failure Context:**
${JSON.stringify(failureContext, null, 2)}

**Required Analysis (JSON format only):**
{
  "failureSummary": "Brief summary of what happened (2-3 sentences)",
  "rootCauses": [
    {
      "cause": "Identified cause",
      "impact": "high|medium|low",
      "likelihood": "high|medium|low"
    }
  ],
  "contributingFactors": ["factor1", "factor2", "factor3"],
  "whatWentWell": ["positive1", "positive2"],
  "lessonsLearned": ["lesson1", "lesson2", "lesson3"],
  "actionableRecommendations": [
    {
      "recommendation": "Specific recommendation",
      "priority": "high|medium|low",
      "implementation": "How to implement"
    }
  ],
  "recoveryPlan": {
    "immediateActions": ["action1", "action2"],
    "shortTermGoals": ["goal1", "goal2"],
    "longTermStrategy": "Strategy description"
  },
  "preventionStrategies": ["strategy1", "strategy2", "strategy3"],
  "encouragement": "Motivational message to help user bounce back"
}

Be constructive, not judgmental. Focus on learning and improvement.`;

    const responseText = await callGemini(prompt, systemPrompt, 90000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn('Failure post-mortem generation failed, using fallback:', error.message);
    return {
      failureSummary: 'Streak was reset. This is a learning opportunity.',
      rootCauses: [],
      contributingFactors: ['Inconsistent tracking', 'Lack of reminders'],
      whatWentWell: ['Previous consistency', 'Effort made'],
      lessonsLearned: ['Consistency is key', 'Set reminders', 'Start fresh'],
      actionableRecommendations: [
        {
          recommendation: 'Set up reminders',
          priority: 'high',
          implementation: 'Configure daily reminders for this habit'
        }
      ],
      recoveryPlan: {
        immediateActions: ['Restart the habit', 'Set reminders'],
        shortTermGoals: ['Build a 3-day streak', 'Check in daily'],
        longTermStrategy: 'Focus on consistency over perfection'
      },
      preventionStrategies: ['Set reminders', 'Track consistently', 'Start small'],
      encouragement: 'Every setback is a setup for a comeback. You\'ve got this!'
    };
  }
}

// ============================================================================
// 7. LIFE DASHBOARD ANALYTICS
// ============================================================================

/**
 * Generate AI-powered weekly summaries, graphs insights, and long-term projections
 * 
 * @param {string} userId - User ID
 * @param {Object} analyticsData - Weekly/monthly analytics data
 * @param {string} period - Time period (weekly, monthly, yearly)
 * @returns {Promise<Object>} - AI-generated summaries and projections
 */
export async function generateLifeDashboardAnalytics(userId, analyticsData, period = 'weekly') {
  try {
    const systemPrompt = 'You are an expert data analyst and life coach. Generate insightful summaries and projections. Always respond with valid JSON only.';

    const prompt = `Analyze this ${period} habit tracking data and generate comprehensive insights.

**Analytics Data:**
${JSON.stringify(analyticsData, null, 2)}

**Required Analysis (JSON format only):**
{
  "summary": {
    "overview": "Overall summary (3-4 sentences)",
    "highlights": ["highlight1", "highlight2", "highlight3"],
    "lowlights": ["area1", "area2"] or []
  },
  "insights": {
    "trends": ["trend1", "trend2", "trend3"],
    "patterns": ["pattern1", "pattern2"],
    "breakthroughs": ["breakthrough1", "breakthrough2"] or []
  },
  "graphInsights": {
    "completionRate": "Insight about completion rate trend",
    "streakPerformance": "Insight about streak performance",
    "categoryBreakdown": "Insight about category performance"
  },
  "projections": {
    "nextWeek": {
      "predictedCompletions": 0-7,
      "confidence": 0-100,
      "recommendations": ["rec1", "rec2"]
    },
    "nextMonth": {
      "predictedCompletions": 0-30,
      "confidence": 0-100,
      "growthAreas": ["area1", "area2"]
    },
    "longTerm": {
      "projection": "Long-term growth projection (2-3 sentences)",
      "milestones": ["milestone1", "milestone2"]
    }
  },
  "recommendations": {
    "immediate": ["rec1", "rec2"],
    "strategic": ["rec1", "rec2"]
  },
  "celebration": {
    "achievements": ["achievement1", "achievement2"],
    "message": "Celebratory message"
  }
}

Provide actionable, data-driven insights.`;

    const responseText = await callGemini(prompt, systemPrompt, 120000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn('Life dashboard analytics generation failed, using fallback:', error.message);
    return {
      summary: {
        overview: `Your ${period} progress shows consistent tracking.`,
        highlights: ['Good tracking consistency'],
        lowlights: []
      },
      insights: {
        trends: ['Steady progress'],
        patterns: ['Consistent tracking'],
        breakthroughs: []
      },
      graphInsights: {
        completionRate: 'Maintaining good completion rates',
        streakPerformance: 'Streaks are building',
        categoryBreakdown: 'Balanced across categories'
      },
      projections: {
        nextWeek: { predictedCompletions: 5, confidence: 60, recommendations: [] },
        nextMonth: { predictedCompletions: 20, confidence: 50, growthAreas: [] },
        longTerm: { projection: 'Continued growth expected', milestones: [] }
      },
      recommendations: {
        immediate: ['Continue tracking'],
        strategic: ['Maintain consistency']
      },
      celebration: {
        achievements: ['Consistent tracking'],
        message: 'Great job on your progress!'
      }
    };
  }
}

// ============================================================================
// 8. HABIT STACKING ENGINE
// ============================================================================

/**
 * Generate supportive micro-habits that stack with an existing habit
 * 
 * @param {string} userId - User ID
 * @param {Object} baseHabit - The habit to stack upon
 * @param {Object} userContext - User's current habits and preferences
 * @returns {Promise<Object>} - Stack suggestions with micro-habits
 */
export async function generateHabitStack(userId, baseHabit, userContext = {}) {
  try {
    const systemPrompt = 'You are an expert in habit stacking and behavior design. Create complementary micro-habits. Always respond with valid JSON only.';

    const prompt = `Generate habit stacking suggestions for this base habit.

**Base Habit:**
${JSON.stringify(baseHabit, null, 2)}

**User Context:**
${JSON.stringify(userContext, null, 2)}

**Required Response (JSON format only):**
{
  "baseHabit": "${baseHabit.name}",
  "stackingStrategy": "Brief explanation of the stacking approach",
  "microHabits": [
    {
      "name": "Micro-habit name",
      "description": "Description of the micro-habit",
      "stackingPosition": "before|after|during",
      "difficulty": "easy",
      "estimatedTime": "1-5 minutes",
      "benefit": "How it supports the base habit",
      "implementation": "How to implement this micro-habit"
    }
  ],
  "stackingSequence": {
    "before": ["micro-habit1", "micro-habit2"] or [],
    "during": ["micro-habit1"] or [],
    "after": ["micro-habit1", "micro-habit2"] or []
  },
  "tips": ["tip1", "tip2", "tip3"],
  "expectedBenefits": ["benefit1", "benefit2", "benefit3"]
}

Generate 3-5 complementary micro-habits that naturally stack with the base habit.`;

    const responseText = await callGemini(prompt, systemPrompt, 90000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn('Habit stacking generation failed, using fallback:', error.message);
    return {
      baseHabit: baseHabit.name,
      stackingStrategy: 'Add small, easy actions before or after the main habit',
      microHabits: [],
      stackingSequence: { before: [], during: [], after: [] },
      tips: ['Start with one micro-habit', 'Keep it simple', 'Be consistent'],
      expectedBenefits: ['Increased consistency', 'Better habit formation', 'Compound effects']
    };
  }
}

// ============================================================================
// 9. FOCUS BUBBLE MODE
// ============================================================================

/**
 * Generate dynamic micro-motivation phrases for focus mode
 * 
 * @param {string} userId - User ID
 * @param {Object} focusContext - Current focus session context
 * @param {number} elapsedTime - Time elapsed in focus session (minutes)
 * @returns {Promise<Object>} - Dynamic encouragement messages
 */
export async function generateFocusBubbleEncouragement(userId, focusContext = {}, elapsedTime = 0) {
  try {
    const systemPrompt = 'You are a focus and productivity coach. Generate short, powerful motivation phrases. Always respond with valid JSON only.';

    const prompt = `Generate dynamic encouragement for a focus session.

**Focus Context:**
${JSON.stringify(focusContext, null, 2)}

**Elapsed Time:** ${elapsedTime} minutes

**Required Response (JSON format only):**
{
  "currentMessage": "Short motivation phrase (5-10 words)",
  "phase": "start|middle|end",
  "encouragementLevel": "high|medium|low",
  "nextMessages": [
    "Message for +5 minutes",
    "Message for +10 minutes",
    "Message for +15 minutes"
  ],
  "completionMessage": "Message when focus session completes",
  "tips": ["tip1", "tip2"] or []
}

Keep messages short, powerful, and encouraging. Adapt based on elapsed time.`;

    const responseText = await callGemini(prompt, systemPrompt, 60000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn('Focus bubble encouragement generation failed, using fallback:', error.message);
    const messages = [
      'You\'ve got this!',
      'Stay focused!',
      'Keep going!',
      'You\'re doing great!',
      'Almost there!'
    ];
    return {
      currentMessage: messages[Math.floor(Math.random() * messages.length)],
      phase: elapsedTime < 10 ? 'start' : elapsedTime < 25 ? 'middle' : 'end',
      encouragementLevel: 'medium',
      nextMessages: messages,
      completionMessage: 'Great focus session! Well done!',
      tips: ['Stay hydrated', 'Take breaks']
    };
  }
}

// ============================================================================
// 10. GEMINI AUTO-JOURNAL
// ============================================================================

/**
 * Expand short user entries into full reflective journals
 * 
 * @param {string} userId - User ID
 * @param {string} shortEntry - User's short journal entry
 * @param {Object} context - Additional context (habits, mood, etc.)
 * @returns {Promise<Object>} - Expanded journal entry
 */
export async function expandAutoJournal(userId, shortEntry, context = {}) {
  try {
    const systemPrompt = 'You are a reflective writing coach. Expand short entries into thoughtful, reflective journal entries. Always respond with valid JSON only.';

    const prompt = `Expand this short journal entry into a full, reflective journal entry.

**Short Entry:**
"${shortEntry}"

**Context:**
${JSON.stringify(context, null, 2)}

**Required Response (JSON format only):**
{
  "originalEntry": "${shortEntry}",
  "expandedEntry": "Full reflective journal entry (3-5 paragraphs)",
  "reflections": {
    "emotions": ["emotion1", "emotion2"],
    "insights": ["insight1", "insight2"],
    "gratitude": ["gratitude1", "gratitude2"] or []
  },
  "connections": {
    "habits": ["connection to habit1", "connection to habit2"] or [],
    "goals": ["connection to goal1"] or [],
    "patterns": ["pattern observed"] or []
  },
  "prompts": [
    "Follow-up reflection question 1",
    "Follow-up reflection question 2"
  ],
  "tags": ["tag1", "tag2", "tag3"]
}

Make the expansion thoughtful, reflective, and meaningful. Preserve the user's original intent.`;

    const responseText = await callGemini(prompt, systemPrompt, 90000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn('Auto-journal expansion failed, using fallback:', error.message);
    return {
      originalEntry: shortEntry,
      expandedEntry: shortEntry + ' This is a meaningful moment worth reflecting on.',
      reflections: {
        emotions: [],
        insights: [],
        gratitude: []
      },
      connections: {
        habits: [],
        goals: [],
        patterns: []
      },
      prompts: ['What did you learn from this?', 'How does this relate to your goals?'],
      tags: ['reflection']
    };
  }
}

// ============================================================================
// LEGACY FUNCTIONS (for backward compatibility)
// ============================================================================

/**
 * Analyze user's habit progress and provide insights (Legacy)
 */
export async function analyzeProgress(userId, habits, checkIns) {
  try {
    const systemPrompt = 'You are an expert habit tracking coach. Always respond with valid JSON only.';

    const prompt = `Analyze the following user's habit tracking data.

**User Habits:**
${JSON.stringify(habits, null, 2)}

**Check-in History:**
${JSON.stringify(checkIns, null, 2)}

**Required Analysis (JSON format only):**
{
  "analysis": "Consistency analysis",
  "patterns": "Performance patterns",
  "motivation": "Motivational message",
  "recommendations": ["rec1", "rec2", "rec3"]
}`;

    const responseText = await callGemini(prompt, systemPrompt, 90000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn('Analysis failed, using fallback:', error.message);
    return {
      analysis: 'Continue tracking to see patterns',
      patterns: 'Track consistently to identify patterns',
      motivation: 'Keep up the great work!',
      recommendations: ['Stay consistent', 'Set reminders']
    };
  }
}

/**
 * Get motivational message (Legacy)
 */
export async function getMotivation(userId, currentStreak, recentActivity) {
  try {
    const systemPrompt = 'You are a motivational coach. Be warm and encouraging.';

    const prompt = `Generate a motivational message for a user with ${currentStreak}-day streak.

**Recent Activity:**
${JSON.stringify(recentActivity, null, 2)}

Keep it under 150 words, warm and encouraging.`;

    return await callGemini(prompt, systemPrompt, 60000, false);
  } catch (error) {
    console.warn('Motivation generation failed, using fallback:', error.message);
    return `You're on a ${currentStreak}-day streak! Keep pushing forward!`;
  }
}

/**
 * Recommend habits (Legacy)
 */
export async function recommendHabits(userId, existingHabits, userGoals) {
  try {
    const systemPrompt = 'You are an expert habit coach. Always respond with valid JSON only.';

    const prompt = `Recommend 3-5 new habits based on existing habits and goals.

**Existing Habits:**
${JSON.stringify(existingHabits, null, 2)}

**User Goals:**
${JSON.stringify(userGoals, null, 2)}

**Required Format (JSON only):**
{
  "recommendations": [
    {
      "name": "Habit name",
      "category": "Category",
      "reason": "Why recommend",
      "difficulty": "easy|medium|hard"
    }
  ]
}`;

    const responseText = await callGemini(prompt, systemPrompt, 90000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn('Recommendations failed, using fallback:', error.message);
    return { recommendations: [] };
  }
}

/**
 * Detect inactive user (Legacy)
 */
export async function detectInactiveUser(userId, lastActivity, habits) {
  try {
    const daysSinceActivity = Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24));
    
    const systemPrompt = 'You are a compassionate habit coach. Be empathetic and encouraging.';

    const prompt = `A user hasn't checked in for ${daysSinceActivity} days. Generate a gentle re-engagement message.

**Active Habits:**
${JSON.stringify(habits, null, 2)}

Be empathetic, not pushy. Keep it under 200 words.`;

    return await callGemini(prompt, systemPrompt, 60000, false);
  } catch (error) {
    console.warn('Inactive user detection failed, using fallback:', error.message);
    const daysSinceActivity = Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24));
    return `We noticed you haven't checked in for ${daysSinceActivity} days. Your habits are waiting for you!`;
  }
}

/**
 * Forecast streak risk (Legacy)
 */
export async function forecastStreakRisk(userId, habits) {
  try {
    const systemPrompt = 'You are an expert behavior analyst. Always respond with valid JSON only.';

    const prompt = `Predict which habits are at risk of being dropped.

**Habits:**
${JSON.stringify(habits, null, 2)}

**Required Format (JSON only):**
{
  "atRiskHabits": [
    {
      "name": "Habit name",
      "streak": 5,
      "risk": "low|medium|high",
      "reason": "Why at risk"
    }
  ],
  "riskFactors": {},
  "recommendations": ["rec1", "rec2"]
}`;

    const responseText = await callGemini(prompt, systemPrompt, 90000, true);
    return parseJSONWithRetry(responseText, true);
  } catch (error) {
    console.warn('Streak risk forecast failed, using fallback:', error.message);
    return {
      atRiskHabits: [],
      riskFactors: {},
      recommendations: ['Maintain consistency', 'Set reminders']
    };
  }
}
