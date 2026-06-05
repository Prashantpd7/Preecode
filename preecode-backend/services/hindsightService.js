const HINDSIGHT_API_KEY = process.env.HINDSIGHT_API_KEY;
const HINDSIGHT_BASE_URL = "https://api.hindsight.vectorize.io";

async function saveMemory(memory) {
  try {
    const response = await fetch(
      `${HINDSIGHT_BASE_URL}/v1/retain`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HINDSIGHT_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(memory)
      }
    );

    return await response.json();
  } catch (err) {
    console.error("Hindsight Error:", err);
  }
}

module.exports = {
  saveMemory
};