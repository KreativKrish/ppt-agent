import { driveService } from '@/lib/google-drive';

export async function POST(request: Request) {
    try {
        const { spreadsheetId, googleTokens } = await request.json();

        if (!spreadsheetId) {
            return Response.json({ error: 'Spreadsheet ID is required' }, { status: 400 });
        }

        if (!googleTokens) {
            return Response.json({ error: 'Google tokens are required' }, { status: 400 });
        }

        // Set Google tokens
        driveService.setTokens(googleTokens);

        console.log('Checking pending presentations for spreadsheet:', spreadsheetId);

        // Get all rows from the sheet
        const rows = await driveService.getSheetRows(spreadsheetId);

        if (rows.length === 0) {
            return Response.json({
                success: true,
                message: 'No data found in spreadsheet',
                totalChecked: 0,
                updated: 0
            });
        }

        const updates: any[] = [];
        let checkedCount = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            // Check if row is pending and has generation ID
            // Row format: [PPT Name, Status, Gamma URL, Generation ID, Last Updated]
            if (row[1] === '⏳ Pending' && row[3]) {
                checkedCount++;
                const generationId = row[3];
                const pptName = row[0];

                try {
                    console.log(`Checking generation: ${generationId}`);

                    // Check Gamma API for status
                    const statusResponse = await fetch(
                        `https://public-api.gamma.app/v1.0/generations/${generationId}`,
                        {
                            headers: {
                                'X-API-KEY': process.env.GAMMA_API_KEY || ''
                            }
                        }
                    );

                    if (statusResponse.ok) {
                        const statusData = await statusResponse.json();
                        const currentStatus = statusData.status;

                        console.log(`Generation ${generationId} status: ${currentStatus}`);

                        if (currentStatus === 'done' || currentStatus === 'complete' || currentStatus === 'completed') {
                            const gammaUrl = statusData.gammaUrl || statusData.output?.url || '';

                            if (gammaUrl) {
                                updates.push({
                                    rowIndex: i + 2, // +1 for header, +1 for 1-based indexing
                                    pptName: pptName,
                                    status: '✅ Complete',
                                    url: gammaUrl,
                                    timestamp: new Date().toISOString()
                                });
                                console.log(`✅ Generation ${generationId} completed: ${gammaUrl}`);
                            } else {
                                console.warn(`⚠️ Generation ${generationId} is complete but no URL found`);
                            }
                        } else if (currentStatus === 'failed' || currentStatus === 'error') {
                            updates.push({
                                rowIndex: i + 2,
                                pptName: pptName,
                                status: '❌ Failed',
                                url: '-',
                                timestamp: new Date().toISOString()
                            });
                            console.log(`❌ Generation ${generationId} failed`);
                        } else {
                            console.log(`⏳ Generation ${generationId} still pending (status: ${currentStatus})`);
                        }
                    } else {
                        console.warn(`Failed to check status for ${generationId}: HTTP ${statusResponse.status}`);
                    }
                } catch (err: any) {
                    console.error(`Error checking generation ${generationId}:`, err.message);
                }
            }
        }

        // Update sheet with completed/failed presentations
        if (updates.length > 0) {
            await driveService.updateSheetRows(spreadsheetId, updates);
            console.log(`Updated ${updates.length} rows in spreadsheet`);
        }

        return Response.json({
            success: true,
            message: `Checked ${checkedCount} pending presentations, updated ${updates.length}`,
            totalChecked: checkedCount,
            updated: updates.length,
            updates: updates.map(u => ({
                name: u.pptName,
                status: u.status,
                url: u.url
            }))
        });

    } catch (error: any) {
        console.error('Error updating pending presentations:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
