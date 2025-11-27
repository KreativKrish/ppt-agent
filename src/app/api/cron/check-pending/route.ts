import { driveService } from '@/lib/google-drive';

export async function GET(request: Request) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.error('Unauthorized cron access attempt');
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        console.log('Starting cron job: Checking pending presentations...');

        // Get list of tracking spreadsheets from environment variable
        const trackingSheetsEnv = process.env.TRACKING_SHEETS || '[]';
        const trackingSheets = JSON.parse(trackingSheetsEnv) as Array<{
            id: string;
            name: string;
        }>;

        if (trackingSheets.length === 0) {
            console.log('No tracking sheets configured');
            return Response.json({
                success: true,
                message: 'No tracking sheets to check',
                checked: 0,
                updated: 0
            });
        }

        let totalChecked = 0;
        let totalUpdated = 0;
        const results: any[] = [];

        for (const sheet of trackingSheets) {
            try {
                console.log(`Checking sheet: ${sheet.name} (${sheet.id})`);

                // Get all rows from the sheet
                const rows = await driveService.getSheetRows(sheet.id);
                const updates: any[] = [];

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];

                    // Check if row is pending and has generation ID
                    // Row format: [PPT Name, Status, Gamma URL, Generation ID, Last Updated]
                    if (row[1] === '⏳ Pending' && row[3]) {
                        totalChecked++;
                        const generationId = row[3];
                        const pptName = row[0];

                        try {
                            console.log(`Checking generation: ${generationId}`);

                            // Check Gamma API for status
                            const statusResponse = await fetch(
                                `https://public-api.gamma.app/v1.0/generations/${generationId}`,
                                { headers: { 'X-API-KEY': process.env.GAMMA_API_KEY || '' } }
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
                    await driveService.updateSheetRows(sheet.id, updates);
                    totalUpdated += updates.length;
                    console.log(`Updated ${updates.length} rows in ${sheet.name}`);
                }

                results.push({
                    sheetName: sheet.name,
                    checked: rows.filter(r => r[1] === '⏳ Pending').length,
                    updated: updates.length
                });

            } catch (sheetError: any) {
                console.error(`Error processing sheet ${sheet.name}:`, sheetError.message);
                results.push({
                    sheetName: sheet.name,
                    error: sheetError.message
                });
            }
        }

        console.log(`Cron job completed: Checked ${totalChecked}, Updated ${totalUpdated}`);

        return Response.json({
            success: true,
            timestamp: new Date().toISOString(),
            totalChecked,
            totalUpdated,
            results
        });

    } catch (error: any) {
        console.error('Cron job error:', error);
        return Response.json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
