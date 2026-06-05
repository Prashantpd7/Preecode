const HINDSIGHT_API_KEY = process.env.HINDSIGHT_API_KEY;
const HINDSIGHT_BASE_URL = process.env.HINDSIGHT_BASE_URL || "https://api.hindsight.vectorize.io";
const HINDSIGHT_MEMORY_BANK = process.env.HINDSIGHT_MEMORY_BANK || "Preecode Memory";

const isHindsightConfigured = () => {
  return !!HINDSIGHT_API_KEY;
};

async function saveMemory(memoryData) {
  if (!isHindsightConfigured()) {
    console.warn("[HINDSIGHT] Memory saving skipped: API key not configured");
    return null;
  }

  try {
    const payload = {
      ...memoryData,
      memory_bank: HINDSIGHT_MEMORY_BANK,
      timestamp: new Date().toISOString()
    };

    const response = await fetch(
      `${HINDSIGHT_BASE_URL}/v1/retain`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HINDSIGHT_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        timeout: 5000
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HINDSIGHT] API error (${response.status}):`, errorText);
      return null;
    }

    const result = await response.json();
    console.log(`[HINDSIGHT MEMORY SAVED] Type: ${memoryData.memory_type || 'unknown'}, UserId: ${memoryData.user_id || 'unknown'}`);
    return result;
  } catch (err) {
    console.error("[HINDSIGHT] Memory save failed:", err.message);
    return null;
  }
}

async function getUserMemories(userId) {
  if (!isHindsightConfigured()) {
    console.warn("[HINDSIGHT] Memory retrieval skipped: API key not configured");
    return [];
  }

  try {
    const response = await fetch(
      `${HINDSIGHT_BASE_URL}/v1/recall`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HINDSIGHT_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: userId,
          memory_bank: HINDSIGHT_MEMORY_BANK
        }),
        timeout: 5000
      }
    );

    if (!response.ok) {
      console.error(`[HINDSIGHT] Recall API error (${response.status})`);
      return [];
    }

    const result = await response.json();
    return result.memories || [];
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
    const response = await fetch(
      `${HINDSIGHT_BASE_URL}/v1/recall`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HINDSIGHT_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: userId,
          query: query,
          memory_bank: HINDSIGHT_MEMORY_BANK
        }),
        timeout: 5000
      }
    );

    if (!response.ok) {
      console.error(`[HINDSIGHT] Search API error (${response.status})`);
      return [];
    }

    const result = await response.json();
    return result.memories || [];
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