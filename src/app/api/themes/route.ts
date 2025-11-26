import { NextResponse } from "next/server";

export async function GET() {
    try {
        const apiKey = process.env.GAMMA_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: "GAMMA_API_KEY not configured" },
                { status: 500 }
            );
        }

        // Fetch themes from Gamma API
        const response = await fetch("https://public-api.gamma.app/v1.0/themes", {
            method: "GET",
            headers: {
                "X-API-KEY": apiKey,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gamma API Error:", errorText);
            return NextResponse.json(
                { error: "Failed to fetch themes from Gamma API", details: errorText },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Return the themes data
        // Expected format: { data: [{ id, name, type, colorKeywords, toneKeywords }], nextCursor }
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Server Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: error.message },
            { status: 500 }
        );
    }
}
