/**
 * AI Report Model - Firestore Schema
 */

export const AIReportSchema = {
  id: 'string',
  userId: 'string',
  type: 'daily | weekly | insight | chat',
  content: 'object',
  generatedAt: 'timestamp',
  metadata: 'object | null'
};

/**
 * Create AI report data
 */
export function createAIReportData(userId, reportData) {
  return {
    userId,
    type: reportData.type,
    content: reportData.content,
    generatedAt: new Date(),
    metadata: reportData.metadata || null
  };
}


