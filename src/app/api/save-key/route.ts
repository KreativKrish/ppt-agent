import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
    try {
        const { apiKey } = await request.json();

        if (!apiKey) {
            return NextResponse.json({ error: "API Key is required" }, { status: 400 });
        }

        const envFilePath = path.join(process.cwd(), ".env.local");

        // Read existing content if any
        let envContent = "";
        if (fs.existsSync(envFilePath)) {
            envContent = fs.readFileSync(envFilePath, "utf-8");
        }

        // Check if GAMMA_API_KEY already exists
        if (envContent.includes("GAMMA_API_KEY=")) {
            // Replace existing key
            envContent = envContent.replace(/GAMMA_API_KEY=.*/g, `GAMMA_API_KEY=${apiKey}`);
        } else {
            // Append new key
            envContent += `\nGAMMA_API_KEY=${apiKey}\n`;
        }

        fs.writeFileSync(envFilePath, envContent);

        return NextResponse.json({ success: true, message: "API Key saved to .env.local" });
    } catch (error: any) {
        console.error("Error saving API key:", error);
        return NextResponse.json(
            { error: "Failed to save API key", details: error.message },
            { status: 500 }
        );
    }
}
