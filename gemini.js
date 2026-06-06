// ==================== gemini.js ====================
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment variables');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const memoryPath = path.join(__dirname, 'memory.json');

function loadMemory() {
  try {
    if (fs.existsSync(memoryPath)) {
      const data = fs.readFileSync(memoryPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('❌ Error reading memory:', e.message);
  }
  return {};
}

function saveMemory(memory) {
  try {
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2), 'utf8');
  } catch (e) {
    console.error('❌ Error saving memory:', e.message);
  }
}

async function getAIResponseWithMemory(userId, userMessage) {
  let memory = loadMemory();

  if (!memory[userId]) {
    memory[userId] = [];
  }

  memory[userId].push({ role: 'user', parts: [{ text: userMessage }] });

  if (memory[userId].length > 10) {
    memory[userId] = memory[userId].slice(-10);
  }

  try {
    const chat = aiModel.startChat({
      history: memory[userId].slice(0, -1),
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.8
      }
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();

    memory[userId].push({ role: 'model', parts: [{ text: responseText }] });
    saveMemory(memory);

    return responseText;
  } catch (error) {
    console.error(`❌ Gemini Error for ${userId}:`, error.message);
    delete memory[userId];
    saveMemory(memory);

    try {
      const fallbackResult = await aiModel.generateContent(userMessage);
      return fallbackResult.response.text();
    } catch (err) {
      return null;
    }
  }
}

function clearUserMemory(userId) {
  const memory = loadMemory();
  delete memory[userId];
  saveMemory(memory);
}

module.exports = { getAIResponseWithMemory, clearUserMemory };