// services/analysisService.js - AI Analysis Service
const axios = require('axios');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const AI_MODEL = process.env.AI_MODEL || 'deepseek/deepseek-chat';

/**
 * Extract intent from transcription using AI
 */
async function extractIntent(transcription) {
  try {
    console.log('🎯 Extracting intent from transcription...');
    
    if (!OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key not configured');
    }

    const intentPrompt = `Analyze this customer service call transcription and extract the following information. Respond ONLY with valid JSON, no markdown or code blocks.

Required JSON structure:
{
  "primary_intent": "one of: Query, Complaint, Request, Feedback, Technical Issue, Billing Issue, General Inquiry",
  "secondary_intents": ["additional intents if any"],
  "topics": ["topic1", "topic2", "topic3"],
  "sentiment": "one of: Positive, Neutral, Negative",
  "sentiment_score": number between -100 and 100,
  "urgency": "one of: Low, Medium, High, Critical",
  "entities": ["entity1", "entity2"],
  "keywords": ["keyword1", "keyword2"]
}

Call Transcription:
${transcription}

Remember: Output ONLY the JSON object, nothing else.`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: AI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing customer service calls. Always respond with ONLY valid JSON, no markdown formatting or code blocks.'
          },
          { role: 'user', content: intentPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Avanza Call Analytics'
        }
      }
    );

    let intentData;
    const content = response.data.choices[0].message.content;

    // Clean the response (remove markdown code blocks if present)
    const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      intentData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response content:', content);
      throw new Error('Failed to parse intent data from AI response');
    }

    console.log(`✅ Intent extracted: ${intentData.primary_intent}, Sentiment: ${intentData.sentiment}`);

    return intentData;

  } catch (error) {
    console.error('❌ Intent extraction failed:', error.message);
    throw error;
  }
}

/**
 * Generate comprehensive AI analysis
 */
async function generateAnalysis(transcription, intentData) {
  try {
    console.log('🤖 Generating comprehensive AI analysis...');

    if (!OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key not configured');
    }

    const analysisPrompt = `You are an enterprise-grade AI Call Analysis system designed to create
**customer memory and handling guidance** for CRM and call centers.

Your goal is NOT to analyze agents,
but to help a NEW agent instantly understand:
- what the customer's problem was
- what kind of customer this is
- how to handle them properly

Do NOT invent facts.
Be clear, concise, and practical.

TRANSCRIPTION:
${transcription}

INTENT DATA:
${JSON.stringify(intentData, null, 2)}

Provide the analysis using EXACTLY the following sections and headings:

### Call Summary
Briefly explain why the customer called and what the core problem was (2-3 sentences).

### Customer Pain Points
List the key concerns raised by the customer.
Focus on financial, emotional, policy, or service-related issues.
- Pain point 1
- Pain point 2
- Pain point 3

### Customer Interaction Profile
Describe the customer so a new agent knows how to deal with them.

- **Emotional Tone**: (e.g., anxious, frustrated, calm, angry, happy)
- **Primary Sensitivity**: (price, billing, delays, trust, quality, service)
- **Churn Risk**: (Low / Medium / High / Critical)
- **Recommended Communication Style**: (reassuring, direct, empathetic, brief, professional, etc.)

### Recommended Agent Approach
Give clear guidance for handling THIS CUSTOMER.

**Do:**
- Bullet point 1
- Bullet point 2
- Bullet point 3

**Avoid:**
- Bullet point 1
- Bullet point 2
- Bullet point 3

### Suggested Opening Line
Provide ONE natural, empathetic sentence the agent can use verbatim when calling this customer back.

Example: "Hi [Name], I understand you've been experiencing issues with [X], and I'm here to make sure we resolve this for you today."

### AI Risk Assessment
Provide percentage estimates:

- **Churn Risk**: X% (based on frustration level, issue severity, previous history)
- **Escalation Risk**: X% (likelihood this will escalate to manager)
- **Refund Likelihood**: X% (likelihood customer will request refund)

### CRM Tags
Provide 3-5 short, standardized hashtags for CRM categorization.
Example: #Billing #PriceSensitive #ChurnRisk #FollowUpRequired

### Action Items
**During the Call:**
- Action item 1
- Action item 2

**After the Call:**
- Action item 1
- Action item 2

### Compliance & Follow-Up Status
Use these symbols:
✔ Completed  
⚠ Pending  
❌ Missing

- Call recording consent: 
- Customer data verified: 
- Follow-up scheduled: 
- CRM updated: 
`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: AI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert call center quality analyst with years of experience in customer service evaluation.'
          },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.5,
        max_tokens: 2500
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Avanza Call Analytics'
        }
      }
    );

    const analysis = response.data.choices[0].message.content;

    console.log('✅ Analysis generated successfully');

    return analysis;

  } catch (error) {
    console.error('❌ Analysis generation failed:', error.message);
    throw error;
  }
}

/**
 * Parse analysis text and extract structured data
 */
function parseAnalysisStructure(analysisText) {
  const structure = {
    call_summary: null,
    customer_pain_points: [],
    emotional_tone: null,
    primary_sensitivity: null,
    churn_risk_assessment: null,
    recommended_communication_style: null,
    agent_approach_do: [],
    agent_approach_avoid: [],
    agent_opening_line: null,
    churn_risk_score: null,
    escalation_risk_score: null,
    refund_likelihood_score: null,
    crm_tags: [],
    action_items_during: [],
    action_items_after: []
  };

  try {
    // Extract Call Summary
    const summaryMatch = analysisText.match(/### Call Summary\s+([\s\S]*?)(?=###|$)/);
    if (summaryMatch) {
      structure.call_summary = summaryMatch[1].trim();
    }

    // Extract Customer Pain Points
    const painPointsMatch = analysisText.match(/### Customer Pain Points\s+([\s\S]*?)(?=###|$)/);
    if (painPointsMatch) {
      const points = painPointsMatch[1].match(/- (.+)/g);
      if (points) {
        structure.customer_pain_points = points.map(p => p.replace(/^- /, '').trim());
      }
    }

    // Extract Interaction Profile
    const profileMatch = analysisText.match(/### Customer Interaction Profile\s+([\s\S]*?)(?=###|$)/);
    if (profileMatch) {
      const profile = profileMatch[1];
      
      const toneMatch = profile.match(/\*\*Emotional Tone\*\*:\s*(.+)/);
      if (toneMatch) structure.emotional_tone = toneMatch[1].trim();
      
      const sensitivityMatch = profile.match(/\*\*Primary Sensitivity\*\*:\s*(.+)/);
      if (sensitivityMatch) structure.primary_sensitivity = sensitivityMatch[1].trim();
      
      const churnMatch = profile.match(/\*\*Churn Risk\*\*:\s*(.+)/);
      if (churnMatch) structure.churn_risk_assessment = churnMatch[1].trim().toLowerCase();
      
      const styleMatch = profile.match(/\*\*Recommended Communication Style\*\*:\s*(.+)/);
      if (styleMatch) structure.recommended_communication_style = styleMatch[1].trim();
    }

    // Extract Agent Approach - Do
    const doMatch = analysisText.match(/\*\*Do:\*\*\s+([\s\S]*?)(?=\*\*Avoid:\*\*|###)/);
    if (doMatch) {
      const doPoints = doMatch[1].match(/- (.+)/g);
      if (doPoints) {
        structure.agent_approach_do = doPoints.map(p => p.replace(/^- /, '').trim());
      }
    }

    // Extract Agent Approach - Avoid
    const avoidMatch = analysisText.match(/\*\*Avoid:\*\*\s+([\s\S]*?)(?=###|$)/);
    if (avoidMatch) {
      const avoidPoints = avoidMatch[1].match(/- (.+)/g);
      if (avoidPoints) {
        structure.agent_approach_avoid = avoidPoints.map(p => p.replace(/^- /, '').trim());
      }
    }

    // Extract Opening Line
    const openingMatch = analysisText.match(/### Suggested Opening Line\s+([\s\S]*?)(?=###|$)/);
    if (openingMatch) {
      structure.agent_opening_line = openingMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    // Extract Risk Scores
    const riskMatch = analysisText.match(/### AI Risk Assessment\s+([\s\S]*?)(?=###|$)/);
    if (riskMatch) {
      const risks = riskMatch[1];
      
      const churnRiskMatch = risks.match(/Churn Risk\*\*:\s*(\d+)%/);
      if (churnRiskMatch) structure.churn_risk_score = parseInt(churnRiskMatch[1]);
      
      const escalationMatch = risks.match(/Escalation Risk\*\*:\s*(\d+)%/);
      if (escalationMatch) structure.escalation_risk_score = parseInt(escalationMatch[1]);
      
      const refundMatch = risks.match(/Refund Likelihood\*\*:\s*(\d+)%/);
      if (refundMatch) structure.refund_likelihood_score = parseInt(refundMatch[1]);
    }

    // Extract CRM Tags
    const tagsMatch = analysisText.match(/### CRM Tags\s+([\s\S]*?)(?=###|$)/);
    if (tagsMatch) {
      const tags = tagsMatch[1].match(/#\w+/g);
      if (tags) {
        structure.crm_tags = tags;
      }
    }

    // Extract Action Items
    const actionsMatch = analysisText.match(/### Action Items\s+([\s\S]*?)(?=###|$)/);
    if (actionsMatch) {
      const actions = actionsMatch[1];
      
      const duringMatch = actions.match(/\*\*During the Call:\*\*\s+([\s\S]*?)(?=\*\*After the Call:\*\*|$)/);
      if (duringMatch) {
        const duringPoints = duringMatch[1].match(/- (.+)/g);
        if (duringPoints) {
          structure.action_items_during = duringPoints.map(p => p.replace(/^- /, '').trim());
        }
      }
      
      const afterMatch = actions.match(/\*\*After the Call:\*\*\s+([\s\S]*?)(?=###|$)/);
      if (afterMatch) {
        const afterPoints = afterMatch[1].match(/- (.+)/g);
        if (afterPoints) {
          structure.action_items_after = afterPoints.map(p => p.replace(/^- /, '').trim());
        }
      }
    }

  } catch (parseError) {
    console.warn('⚠️ Warning: Could not parse all analysis sections:', parseError.message);
  }

  return structure;
}

/**
 * Calculate quality score based on call analysis
 */
function calculateQualityScore(intentData, analysisStructure) {
  let score = 50; // Base score

  // Sentiment impact
  if (intentData.sentiment === 'Positive') score += 30;
  else if (intentData.sentiment === 'Neutral') score += 15;
  else if (intentData.sentiment === 'Negative') score -= 10;

  // Urgency impact
  if (intentData.urgency === 'Low') score += 10;
  else if (intentData.urgency === 'Critical') score -= 10;

  // Churn risk impact
  const churnRisk = analysisStructure.churn_risk_assessment?.toLowerCase();
  if (churnRisk === 'low') score += 10;
  else if (churnRisk === 'high' || churnRisk === 'critical') score -= 15;

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Estimate CSAT score
 */
function estimateCSAT(intentData, analysisStructure) {
  if (intentData.sentiment === 'Positive') return 4.5;
  if (intentData.sentiment === 'Neutral') return 3.5;
  
  const churnRisk = analysisStructure.churn_risk_assessment?.toLowerCase();
  if (churnRisk === 'critical' || churnRisk === 'high') return 2.0;
  
  return 2.5;
}

module.exports = {
  extractIntent,
  generateAnalysis,
  parseAnalysisStructure,
  calculateQualityScore,
  estimateCSAT
};