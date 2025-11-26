import { driveService } from '@/lib/google-drive';
import { parseExcelToC } from '@/lib/excel-parser';
import { generateOutline, splitOutlineIntoChunks, convertOutlineToText } from '@/lib/gemini';

export async function POST(request: Request) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            let isClosed = false;

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

            try {
                const body = await request.json();
                const {
                    driveFileId,
                    driveFolderId,
                    gammaFolderId,
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
                if (googleTokens) {
                    driveService.setTokens(googleTokens);
                }

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
                const units = parseExcelToC(excelBuffer);
                console.log(`Found ${units.length} units`);
                sendUpdate({ type: 'progress', message: `Found ${units.length} units` });

                // Process units sequentially
                for (let i = 0; i < units.length; i++) {
                    const unit = units[i];
                    sendUpdate({ type: 'progress', message: `Processing ${unit.unitName} (${i + 1}/${units.length})...` });

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

                            const maxPolls = 300; // 300 polls * 3s = ~15 minutes (Gamma can be slow)
                            const pollInterval = 3000;

                            for (let k = 0; k < maxPolls; k++) {
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
                                throw new Error(
                                    `Gamma generation timed out after ${minutesWaited} minutes. ` +
                                    `The presentation may still be generating in Gamma. ` +
                                    `Try checking your Gamma account for the presentation.`
                                );
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
