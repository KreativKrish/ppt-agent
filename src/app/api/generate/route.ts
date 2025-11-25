import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { apiKey: bodyApiKey, ...params } = body;

        // Prioritize Request Body (User Input), then Environment Variable
        // This allows users to override the server-side key if needed.
        const rawApiKey = bodyApiKey || process.env.GAMMA_API_KEY;
        const apiKey = rawApiKey?.trim();

        console.log("Debug - API Key Source:", bodyApiKey ? "Request Body" : "Environment Variable");
        console.log("Debug - API Key (Masked):", apiKey ? `${apiKey.substring(0, 10)}...` : "Missing");
        console.log("Debug - Env Var Value:", process.env.GAMMA_API_KEY ? `${process.env.GAMMA_API_KEY.substring(0, 10)}...` : "Not Set");

        if (!apiKey) {
            return NextResponse.json({ error: "API Key is required (in Environment or Request)" }, { status: 400 });
        }

        // Construct the payload for Gamma API
        const payload = {
            inputText: params.inputText,
            textMode: params.textMode || "preserve",
            format: params.format,
            themeId: params.themeId || undefined,
            numCards: params.numCards ? Number(params.numCards) : undefined,
            cardSplit: params.cardSplit,
            additionalInstructions: params.additionalInstructions || undefined,
            exportAs: params.exportAs || undefined,
            folderIds: params.folderIds ? params.folderIds.split(",").map((id: string) => id.trim()) : undefined,
            textOptions: {
                amount: params.textAmount || "brief",
                tone: params.textTone,
                audience: params.textAudience || undefined,
                language: params.textLanguage || undefined,
            },
            imageOptions: {
                source: params.imageSource,
                model: params.imageModel || undefined,
                style: params.imageStyle || undefined,
            },
            cardOptions: {
                dimensions: params.cardDimensions || "4:3",
                headerFooter: {
                    hideFromFirstCard: params.hideFromFirstCard,
                    hideFromLastCard: params.hideFromLastCard,
                    bottomCenter: params.footerText ? { type: "text", content: params.footerText } : undefined,
                    bottomRight: params.showCardNumbers ? { type: "cardNumber" } : undefined,
                }
            },
            sharingOptions: {
                workspaceAccess: params.workspaceAccess || "fullAccess",
                externalAccess: params.externalAccess || "edit",
            }
        };

        const response = await fetch("https://public-api.gamma.app/v1.0/generations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-KEY": apiKey,
            },
            body: JSON.stringify(payload),
        });

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
