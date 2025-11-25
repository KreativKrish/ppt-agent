import { NextResponse } from "next/server";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ generationId: string }> }
) {
    try {
        const { generationId } = await params;
        const apiKey = process.env.GAMMA_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: "API Key not configured" }, { status: 500 });
        }

        console.log(`Checking status for generation: ${generationId}`);

        const response = await fetch(
            `https://public-api.gamma.app/v1.0/generations/${generationId}`,
            {
                method: "GET",
                headers: {
                    "X-API-KEY": apiKey,
                },
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Gamma API Error:", data);
            return NextResponse.json(
                { error: data.message || "Error from Gamma API", details: data },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Server Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", message: error.message },
            { status: 500 }
        );
    }
}
