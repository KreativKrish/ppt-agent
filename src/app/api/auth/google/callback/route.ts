import { NextResponse } from 'next/server';
import { driveService } from '@/lib/google-drive';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');

        if (!code) {
            return NextResponse.json(
                { error: 'Authorization code not provided' },
                { status: 400 }
            );
        }

        const tokens = await driveService.setCredentials(code);

        // In production, you'd want to store these tokens securely
        // For now, we'll return them to be stored client-side
        return NextResponse.redirect(
            new URL(`/?auth=success&tokens=${encodeURIComponent(JSON.stringify(tokens))}`, request.url)
        );
    } catch (error: any) {
        console.error('OAuth callback error:', error);
        return NextResponse.redirect(
            new URL(`/?auth=error&message=${encodeURIComponent(error.message)}`, request.url)
        );
    }
}
