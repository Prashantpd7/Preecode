const { HindsightClient } = require('@vectorize-io/hindsight-client');

const HINDSIGHT_API_KEY = process.env.HINDSIGHT_API_KEY;
const HINDSIGHT_BASE_URL = process.env.HINDSIGHT_BASE_URL || "https://api.hindsight.vectorize.io";
const HINDSIGHT_MEMORY_BANK = process.env.HINDSIGHT_MEMORY_BANK || "Preecode Memory";

let hindsightClient = null;

const isHindsightConfigured = () => {
  return !!HINDSIGHT_API_KEY;
};

const getHindsightClient = () => {
  if (!hindsightClient && isHindsightConfigured()) {
    try {
      hindsightClient = new HindsightClient({
        baseUrl: HINDSIGHT_BASE_URL,
        apiKey: HINDSIGHT_API_KEY
      });
    } catch (err) {
      console.error("[HINDSIGHT] Failed to initialize client:", err.message);
      return null;
    }
  }
  return hindsightClient;
};

async function saveMemory(memoryData) {
  console.log("🔥 HINDSIGHT saveMemory CALLED", memoryData);
  if (!isHindsightConfigured()) {
    console.warn("[HINDSIGHT] Memory saving skipped: API key not configured");
    return null;
  }

  try {
    const client = getHindsightClient();
    if (!client) {
      console.warn("[HINDSIGHT] Client not initialized");
      return null;
    }

    const content = `[${memoryData.memory_type}] ${memoryData.content}`;

    // Convert all metadata values to strings (Hindsight API requirement)
    const stringMetadata = {};
    if (memoryData.metadata) {
      for (const [key, value] of Object.entries(memoryData.metadata)) {
        stringMetadata[key] = String(value);
      }
    }

    const result = await client.retain(
      HINDSIGHT_MEMORY_BANK,
      content,
      {
        metadata: {
          ...stringMetadata,
          user_id: String(memoryData.user_id),
          memory_type: String(memoryData.memory_type),
          timestamp: new Date().toISOString()
        }
      }
    );

    console.log(`[HINDSIGHT MEMORY SAVED] Type: ${memoryData.memory_type || 'unknown'}, UserId: ${memoryData.user_id || 'unknown'}`, JSON.stringify(result).substring(0, 300));
    return result;
  } catch (err) {
    console.error("[HINDSIGHT] Memory save failed:", err.message, "| statusCode:", err.statusCode, "| details:", err.details || '');
    return null;
  }
}

async function getUserMemories(userId) {
  if (!isHindsightConfigured()) {
    console.warn("[HINDSIGHT] Memory retrieval skipped: API key not configured");
    return [];
  }

  try {
    const client = getHindsightClient();
    if (!client) {
      console.warn("[HINDSIGHT] Client not initialized");
      return [];
    }

    const query = `memories for user ${userId}`;
    const results = await client.recall(
      HINDSIGHT_MEMORY_BANK,
      query
    );

    return results || [];
  } catch (err) {
    console.error("[HINDSIGHT] Memory retrieval failed:", err.message);
    return [];
  }
}

async function searchUserMemories(userId, query) {
  if (!isHindsightConfigured()) {
    console.warn("[HINDSIGHT] Memory search skipped: API key not configured");
    return [];
  }

  try {
    const client = getHindsightClient();
    if (!client) {
      console.warn("[HINDSIGHT] Client not initialized");
      return [];
    }

    const searchQuery = `user ${userId}: ${query}`;
    const results = await client.recall(
      HINDSIGHT_MEMORY_BANK,
      searchQuery
    );

    return results || [];
  } catch (err) {
    console.error("[HINDSIGHT] Memory search failed:", err.message);
    return [];
  }
}

module.exports = {
  saveMemory,
  getUserMemories,
  searchUserMemories,
  isHindsightConfigured
};