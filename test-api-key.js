#!/usr/bin/env node

// Test script to verify Gamma API Key
const apiKey = process.env.GAMMA_API_KEY;

if (!apiKey) {
    console.error("❌ GAMMA_API_KEY not found in environment");
    process.exit(1);
}

console.log("🔑 Testing API Key:", apiKey.substring(0, 15) + "...");
console.log("📡 Sending request to Gamma API...\n");

const testPayload = {
    inputText: "Test presentation about artificial intelligence",
    textMode: "generate",
    format: "presentation"
};

fetch("https://public-api.gamma.app/v1.0/generations", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey
    },
    body: JSON.stringify(testPayload)
})
    .then(async (response) => {
        console.log("📥 Response Status:", response.status);
        const data = await response.json();

        if (response.ok) {
            console.log("✅ SUCCESS! API Key is valid");
            console.log("📄 Response:", JSON.stringify(data, null, 2));
        } else {
            console.log("❌ FAILED! API returned error");
            console.log("📄 Error:", JSON.stringify(data, null, 2));
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error("❌ Request failed:", error.message);
        process.exit(1);
    });
