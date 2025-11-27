import { driveService } from '@/lib/google-drive';
import { parseExcelToC } from '@/lib/excel-parser';
import { generateOutline, splitOutlineIntoChunks, convertOutlineToText } from '@/lib/gemini';
import { findSimilarSheet } from '@/lib/sheet-matcher';

export async function POST(request: Request) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            let isClosed = false;
            let isAborted = false;

            const sendUpdate = (data: any) => {
                if (!isClosed) {
                    try {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    } catch (error) {
                        console.error('Failed to send update:', error);
                        isClosed = true;
                    }
                }
            };

            const closeStream = () => {
                if (!isClosed) {
                    isClosed = true;
                    try {
                        controller.close();
                    } catch (error) {
                        console.error('Failed to close controller:', error);
                    }
                }
            };

            // Listen for abort signal
            request.signal.addEventListener('abort', () => {
                console.log('⚠️ Client aborted request - stopping automation');
                isAborted = true;
                sendUpdate({ type: 'warning', message: 'Automation stopped by user' });
                closeStream();
            });

            try {
                // Track API execution time to prevent Vercel timeout
                const apiStartTime = Date.now();
                const MAX_API_DURATION = 240000; // 240 seconds (4 min safety buffer before 300s limit)

                const body = await request.json();
                const {
                    driveFileId,
                    driveFolderId,
                    gammaFolderId,
                    subjectName,
                    gammaAdditionalInstructions,
                    slidesPerUnit,
                    geminiApiKey,
                    customPrompt,
                    googleTokens,
                    imageSource,
                    imageModel,
                    themeId,
                } = body;

                // Validation
                if (!driveFileId || !customPrompt) {
                    sendUpdate({ type: 'error', message: 'Missing required fields: driveFileId, customPrompt' });
                    closeStream();
                    return;
                }

                const apiKey = geminiApiKey || process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    sendUpdate({ type: 'error', message: 'Gemini API key required' });
                    closeStream();
                    return;
                }

                // Set Google Drive tokens
                if (!googleTokens) {
                    sendUpdate({
                        type: 'error',
                        message: 'Google authentication required. Please sign in with Google first.'
                    });
                    closeStream();
                    return;
                }

                // Validate that tokens include refresh_token
                if (!googleTokens.refresh_token) {
                    sendUpdate({
                        type: 'error',
                        message: 'Google tokens are invalid or expired. Please disconnect and re-authenticate with Google Drive.'
                    });
                    closeStream();
                    return;
                }

                driveService.setTokens(googleTokens);

                console.log('Starting automation...');
                sendUpdate({ type: 'progress', message: 'Starting automation...' });

                console.log('Fetching Excel file from Drive...');
                sendUpdate({ type: 'progress', message: 'Fetching Excel file from Drive...' });

                // Step 1: Fetch Excel file from Drive
                const excelBuffer = await driveService.fetchFileFromDrive(driveFileId);
                console.log('Excel file fetched successfully');
                sendUpdate({ type: 'progress', message: 'Excel file fetched successfully' });


                // Step 2: Parse Excel
                console.log('Parsing Excel ToC...');
                sendUpdate({ type: 'progress', message: 'Parsing Excel ToC...' });
                const { units, subjectName: extractedSubjectName } = parseExcelToC(excelBuffer);
                console.log(`Found ${units.length} units`);
                console.log(`Extracted Subject Name: ${extractedSubjectName}`);
                sendUpdate({ type: 'progress', message: `Found ${units.length} units. Subject: ${extractedSubjectName}` });

                // Use extracted subject name, fallback to provided one (though frontend input will be removed)
                const finalSubjectName = extractedSubjectName || subjectName || "Unknown Subject";

                // Setup Google Sheet for PPT tracking (if folder provided)
                let trackingSpreadsheetId: string | null = null;
                if (driveFolderId) {
                    try {
                        sendUpdate({ type: 'progress', message: 'Setting up Google Sheet tracker...' });
                        console.log('Setting up Google Sheet for subject:', finalSubjectName);

                        // List all files in the folder
                        const filesInFolder = await driveService.listFilesInFolder(driveFolderId);

                        // Filter only spreadsheets
                        const spreadsheets = filesInFolder.filter(
                            file => file.mimeType === 'application/vnd.google-apps.spreadsheet'
                        );

                        console.log(`Found ${spreadsheets.length} spreadsheets in folder`);

                        // Try to find existing sheet with fuzzy matching
                        const matchedSheet = findSimilarSheet(
                            finalSubjectName,
                            spreadsheets.map(s => ({ id: s.id, name: s.name })),
                            0.75  // 75% similarity threshold
                        );

                        if (matchedSheet) {
                            console.log(`Found existing sheet: ${matchedSheet.name} (similarity: ${(matchedSheet.similarity * 100).toFixed(1)}%)`);
                            trackingSpreadsheetId = matchedSheet.id;
                            sendUpdate({
                                type: 'progress',
                                message: `Will update existing sheet: ${matchedSheet.name}`
                            });
                        } else {
                            console.log('No similar sheet found, creating new one...');
                            const sheetTitle = `${finalSubjectName}_PPT_Tracker`;
                            trackingSpreadsheetId = await driveService.createSpreadsheet(sheetTitle, driveFolderId);

                            // Add header row to new sheet with enhanced tracking
                            await driveService.appendRowsToSheet(trackingSpreadsheetId, [
                                ['PPT Name', 'Status', 'Gamma URL', 'Generation ID', 'Last Updated']
                            ]);

                            sendUpdate({
                                type: 'progress',
                                message: `Created tracking sheet: ${sheetTitle}`
                            });
                        }

                        console.log(`Tracking spreadsheet ID: ${trackingSpreadsheetId}`);
                    } catch (sheetError: any) {
                        console.error('Error setting up tracking sheet:', sheetError);
                        sendUpdate({
                            type: 'progress',
                            message: `Warning: Could not setup tracking sheet: ${sheetError.message}`
                        });
                        // Continue with automation even if sheet setup fails
                    }
                }

                // Process units sequentially
                for (let i = 0; i < units.length; i++) {
                    // Check if request was aborted
                    if (isAborted) {
                        console.log('Stopping unit processing due to abort');
                        break;
                    }

                    // Check if we're approaching API timeout limit
                    if (Date.now() - apiStartTime > MAX_API_DURATION) {
                        sendUpdate({
                            type: 'warning',
                            message: 'API timeout approaching. Stopping new units to prevent timeout. Partial results have been saved.'
                        });
                        break; // Exit unit loop gracefully
                    }

                    const unit = units[i];
                    sendUpdate({ type: 'progress', message: `Processing ${unit.unitName} (${i + 1}/${units.length})...` });

                    // Check abort before processing unit
                    if (isAborted) {
                        console.log('Stopping before processing unit due to abort');
                        break;
                    }

                    try {
                        // 1. Generate Outline with Gemini
                        console.log(`\n${'='.repeat(60)}`);
                        console.log(`Processing ${unit.unitName} (${i + 1}/${units.length})...`);
                        console.log(`${'='.repeat(60)}`);
                        console.log('Excel Data Extracted:');
                        console.log(`  Unit Name: ${unit.unitName}`);
                        console.log(`  Level-1 Topics (${unit.level1Topics.length}):`, unit.level1Topics);
                        console.log(`  Level-2 Topics (${unit.level2Topics.length}):`, unit.level2Topics);
                        console.log(`  Level-3 Topics (${unit.level3Topics.length}):`, unit.level3Topics);
                        console.log('');

                        const fullOutline = await generateOutline(
                            unit.unitName,
                            unit.level1Topics,
                            unit.level2Topics,
                            unit.level3Topics,
                            unit.hierarchicalTopics,
                            slidesPerUnit || 10, // Use configurable slide count with fallback
                            apiKey,
                            customPrompt
                        );

                        console.log(`✅ Success with Gemini!`);
                        console.log(`Generated ${fullOutline.length} slides for ${unit.unitName}`);

                        if (fullOutline.length > 0) {
                            console.log('Sample of generated outline (first 2 slides):');
                            fullOutline.slice(0, 2).forEach(slide => {
                                console.log(`  Slide ${slide.slideNumber}: ${slide.title}`);
                                console.log(`  Bullets: ${slide.bulletPoints.length} points`);
                            });
                        } else {
                            console.warn('⚠️ WARNING: No slides generated! Check Gemini API model and response.');
                        }

                        // Check abort before chunking
                        if (isAborted) {
                            console.log('Stopping before chunking due to abort');
                            throw new Error('Aborted by user');
                        }

                        // 2. Split into chunks of 60
                        const chunks = splitOutlineIntoChunks(fullOutline, 60);
                        console.log(`Split into ${chunks.length} chunks`);

                        const chunkUrls: any[] = [];

                        // 3. Process each chunk sequentially
                        for (let j = 0; j < chunks.length; j++) {
                            const chunk = chunks[j];

                            // Extract unit number and create clean name for Gamma presentation
                            // Example: "UNIT – 1 INTRODUCTION TO MACROECONOMICS" → "Unit-1_Introduction-to-Macroeconomics_Part-1"
                            const unitNumberMatch = unit.unitName.match(/UNIT\s*[–-]\s*(\d+)/i);
                            const unitNumber = unitNumberMatch ? unitNumberMatch[1] : '0';

                            // Remove "UNIT – N" prefix and create kebab-case name
                            const cleanName = unit.unitName
                                .replace(/UNIT\s*[–-]\s*\d+\s*/i, '') // Remove "UNIT – N"
                                .trim()
                                .replace(/\s+/g, '-') // Replace spaces with hyphens
                                .replace(/[^a-zA-Z0-9-]/g, '') // Remove special characters
                                .toLowerCase();

                            const partName = `Unit-${unitNumber}_${cleanName}_Part-${j + 1}`;
                            console.log(`Processing ${partName}...`);
                            sendUpdate({ type: 'progress', message: `Generating ${partName}...` });

                            // Convert outline chunk to text
                            const chunkText = convertOutlineToText(chunk);

                            // Debug: Log what we're sending to Gamma
                            console.log(`Chunk ${j + 1} text length: ${chunkText.length} characters`);
                            console.log(`Chunk ${j + 1} preview (first 500 chars):\n${chunkText.substring(0, 500)}...`);

                            // A. Generate Gamma Presentation
                            console.log(`Generating Gamma presentation for ${partName}...`);

                            const gammaPayload: any = {
                                inputText: chunkText,
                                textMode: 'preserve',
                                format: 'presentation',
                                numCards: chunk.length,
                                cardSplit: 'inputTextBreaks',
                                exportAs: 'pptx',
                                imageOptions: {
                                    source: imageSource || 'noImages',
                                    ...(imageSource === 'aiGenerated' && imageModel ? { model: imageModel } : {}),
                                },
                                cardOptions: {
                                    dimensions: '4x3'  // Set aspect ratio to 4x3
                                }
                            };

                            // Add optional Gamma parameters
                            if (gammaFolderId) {
                                gammaPayload.folderIds = [gammaFolderId];
                            }

                            if (gammaAdditionalInstructions) {
                                gammaPayload.additionalInstructions = gammaAdditionalInstructions;
                            }

                            if (themeId) {
                                gammaPayload.themeId = themeId;
                            }

                            const gammaResponse = await fetch('https://public-api.gamma.app/v1.0/generations', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-API-KEY': process.env.GAMMA_API_KEY || '',
                                },
                                body: JSON.stringify(gammaPayload),
                            });

                            if (!gammaResponse.ok) {
                                const errorText = await gammaResponse.text();
                                throw new Error(`Gamma API failed: ${gammaResponse.status} ${errorText}`);
                            }

                            const gammaData = await gammaResponse.json();
                            console.log('Gamma API Response:', JSON.stringify(gammaData, null, 2));

                            const generationId = gammaData.id || gammaData.generation_id || gammaData.generationId;

                            if (!generationId) {
                                throw new Error(`No generation ID found in Gamma response: ${JSON.stringify(gammaData)}`);
                            }

                            console.log(`Generation started: ${generationId}`);

                            // Poll for completion
                            let presentationUrl = '';
                            let pptDownloadUrl = '';
                            let status = 'processing';

                            const maxPolls = 20; // 20 polls * 3s = ~60 seconds (reduced from 15 min to prevent timeout)
                            const pollInterval = 3000;

                            for (let k = 0; k < maxPolls; k++) {
                                // Check abort during polling
                                if (isAborted) {
                                    console.log('Stopping Gamma polling due to abort');
                                    break;
                                }
                                // Check API timeout during polling
                                if (Date.now() - apiStartTime > MAX_API_DURATION) {
                                    sendUpdate({
                                        type: 'warning',
                                        message: `Timeout: Generation ${generationId} still pending after ${maxPolls * pollInterval / 1000}s. Moving to next chunk.`
                                    });
                                    break; // Exit poll loop
                                }

                                await new Promise(resolve => setTimeout(resolve, pollInterval));

                                // Send progress update every 30 seconds
                                if (k % 10 === 0 && k > 0) {
                                    const elapsedMinutes = Math.floor((k * pollInterval) / 60000);
                                    sendUpdate({
                                        type: 'progress',
                                        message: `Still generating ${partName}... (${elapsedMinutes} min elapsed)`
                                    });
                                }

                                try {
                                    const statusResponse = await fetch(`https://public-api.gamma.app/v1.0/generations/${generationId}`, {
                                        headers: { 'X-API-KEY': process.env.GAMMA_API_KEY || '' }
                                    });

                                    if (statusResponse.ok) {
                                        const statusData = await statusResponse.json();
                                        const currentStatus = statusData.status || 'unknown';

                                        if (k % 5 === 0 || currentStatus !== 'pending') {
                                            console.log(`Poll ${k + 1}/${maxPolls}: Status = ${currentStatus}`);
                                        }

                                        if (currentStatus === 'done' || currentStatus === 'complete' || currentStatus === 'completed') {
                                            status = 'done';
                                            presentationUrl = statusData.gammaUrl || statusData.output?.url || statusData.url || statusData.presentationUrl;

                                            pptDownloadUrl = statusData.file_url || statusData.download_url || statusData.export_url || statusData.output?.file_url || statusData.exportUrl || statusData.pptx_url;

                                            if (pptDownloadUrl) {
                                                console.log(`✅ Found PPTX download URL: ${pptDownloadUrl}`);
                                            } else {
                                                console.warn('⚠️ No PPTX download URL found in response');
                                                console.log('Full status data:', JSON.stringify(statusData, null, 2));
                                            }

                                            if (!presentationUrl) {
                                                console.error('Status data:', JSON.stringify(statusData, null, 2));
                                                throw new Error('Generation completed but no URL found');
                                            }
                                            break;
                                        } else if (currentStatus === 'error' || currentStatus === 'failed') {
                                            throw new Error(`Gamma generation failed: ${JSON.stringify(statusData.error || statusData)}`);
                                        }
                                    } else {
                                        console.warn(`Poll ${k + 1}: Status check failed with HTTP ${statusResponse.status}`);

                                        // If it's a network error, retry a few more times
                                        if (k < maxPolls - 1) {
                                            console.log('Retrying after HTTP error...');
                                            continue;
                                        }
                                    }
                                } catch (pollError: any) {
                                    console.error(`Poll ${k + 1}: Network error:`, pollError.message);

                                    // Network errors are common, retry
                                    if (k < maxPolls - 1) {
                                        console.log('Retrying after network error...');
                                        continue;
                                    } else {
                                        throw new Error(`Failed to poll status after network errors: ${pollError.message}`);
                                    }
                                }
                            }

                            if (status !== 'done') {
                                const minutesWaited = Math.floor((maxPolls * pollInterval) / 60000);

                                // Instead of throwing error, send pending status and continue
                                sendUpdate({
                                    type: 'part_pending',
                                    unit: unit.unitName,
                                    part: {
                                        generationId: generationId,
                                        partName: partName,
                                        status: 'pending',
                                        message: `Gamma generation still processing after ${minutesWaited} minute(s). Check your Gamma account or poll status separately.`
                                    }
                                });

                                // Add pending presentation to sheet for tracking
                                if (trackingSpreadsheetId) {
                                    try {
                                        await driveService.appendRowsToSheet(trackingSpreadsheetId, [[
                                            partName,
                                            '⏳ Pending',
                                            '-',
                                            generationId,
                                            new Date().toISOString()
                                        ]]);
                                        console.log(`Added pending generation to tracking sheet: ${generationId}`);
                                    } catch (sheetErr: any) {
                                        console.error('Error adding pending to sheet:', sheetErr.message);
                                    }
                                }

                                // Continue to next chunk instead of failing entire process
                                continue;
                            }

                            // If aborted during polling, break from chunk loop
                            if (isAborted) {
                                console.log('Breaking from chunk loop due to abort');
                                break;
                            }

                            console.log(`Presentation URL: ${presentationUrl}`);

                            const partData = {
                                partNumber: j + 1,
                                gammaUrl: presentationUrl,
                                downloadUrl: pptDownloadUrl || null,
                                partName: partName
                            };

                            chunkUrls.push(partData);

                            // 🚀 SEND IMMEDIATE UPDATE TO FRONTEND
                            sendUpdate({
                                type: 'part_complete',
                                unit: unit.unitName,
                                part: partData
                            });
                        }

                        // Return all parts for this unit
                        console.log(`✅ Completed ${unit.unitName} - generated ${chunks.length} parts`);

                        sendUpdate({
                            type: 'unit_complete',
                            unit: unit.unitName,
                            status: 'completed',
                            parts: chunkUrls
                        });

                        // Append to Google Sheet if tracking is enabled
                        if (trackingSpreadsheetId && chunkUrls.length > 0) {
                            try {
                                const rowsToAppend = chunkUrls
                                    .filter(part => part.gammaUrl) // Only completed ones
                                    .map(part => [
                                        part.partName,
                                        '✅ Complete',
                                        part.gammaUrl,
                                        '-',
                                        new Date().toISOString()
                                    ]);

                                await driveService.appendRowsToSheet(trackingSpreadsheetId, rowsToAppend);
                                console.log(`Added ${rowsToAppend.length} completed PPT links to tracking sheet`);
                            } catch (sheetError: any) {
                                console.error(`Error appending to sheet:`, sheetError.message);
                                // Send warning to user but don't fail the automation
                                sendUpdate({
                                    type: 'progress',
                                    message: `⚠️ Warning: Could not update tracking sheet (${sheetError.message}). Presentations generated successfully.`
                                });
                            }
                        }

                    } catch (error: any) {
                        console.error(`Error processing ${unit.unitName}:`, error);
                        sendUpdate({
                            type: 'unit_error',
                            unit: unit.unitName,
                            status: 'error',
                            error: error.message
                        });
                    }
                }

                sendUpdate({ type: 'complete', message: 'Automation completed!' });
                closeStream();

            } catch (error: any) {
                console.error('Automation error:', error);
                sendUpdate({ type: 'error', message: error.message });
                closeStream();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
