import { NextResponse } from 'next/server';
import { driveService } from '@/lib/google-drive';

export async function GET() {
    try {
        const authUrl = driveService.getAuthUrl();
        return NextResponse.json({ authUrl });
    } catch (error: any) {
        console.error('Error generating auth URL:', error);
        return NextResponse.json(
            { error: 'Failed to generate auth URL', details: error.message },
            { status: 500 }
        );
    }
}
