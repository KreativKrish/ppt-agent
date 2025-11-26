import { GoogleGenerativeAI } from '@google/generative-ai';
import { Level1Topic } from './excel-parser';

export interface OutlineSlide {
    slideNumber: number;
    title: string;
    bulletPoints: string[];
}

export async function generateOutline(
    unitName: string,
    level1Topics: string[],
    level2Topics: string[],
    level3Topics: string[],
    hierarchicalTopics: Level1Topic[],
    slideCount: number,
    apiKey: string,
    customPrompt: string
): Promise<OutlineSlide[]> {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Try with gemini-2.5-pro first, fall back to gemini-2.5-flash if overloaded
    const modelNames = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    let lastError: any = null;

    for (const modelName of modelNames) {
        console.log(`Attempting with model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });

        // Ensure customPrompt is a string
        const promptTemplate = typeof customPrompt === 'string' ? customPrompt : String(customPrompt);

        // Format hierarchical topics as a structured outline
        const hierarchicalStructure = formatHierarchicalTopics(hierarchicalTopics);

        // Replace placeholders in custom prompt
        const prompt = promptTemplate
            .replace('{unitName}', unitName)
            .replace('{level1Topics}', level1Topics.join(', '))
            .replace('{level2Topics}', level2Topics.join(', '))
            .replace('{level3Topics}', level3Topics.join(', '))
            .replace('{hierarchicalTopics}', hierarchicalStructure)
            .replace('{slideCount}', slideCount.toString());

        // Debug: Log what we're sending to Gemini
        // console.log('\n=== GEMINI PROMPT ===');
        // console.log(`Unit: ${unitName}`);
        // console.log(`Level-1 Topics (${level1Topics.length}): ${level1Topics.join(', ')}`);
        // console.log(`Level-2 Topics (${level2Topics.length}): ${level2Topics.join(', ')}`);
        // console.log(`Level-3 Topics (${level3Topics.length}): ${level3Topics.join(', ')}`);
        // console.log(`Slide Count: ${slideCount}`);
        // console.log('\nFull Prompt:');
        // console.log('---');
        // console.log(prompt);
        console.log('---\n');

        // Retry logic with exponential backoff
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Attempt ${attempt}/${maxRetries} with ${modelName}...`);

                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();

                // Debug: Log Gemini's raw response
                console.log('\n=== GEMINI RESPONSE ===');
                console.log(`Response length: ${text.length} characters`);
                // console.log('First 1000 characters:');
                // console.log(text.substring(0, 1000));
                // console.log('...\n');

                // Success! Parse and return
                console.log(`✅ Success with ${modelName}!`);
                return parseOutlineText(text);

            } catch (error: any) {
                lastError = error;
                const isOverloaded = error?.message?.includes('503') || error?.message?.includes('overloaded');
                const isRateLimit = error?.message?.includes('429') || error?.message?.includes('rate limit');

                if (isOverloaded || isRateLimit) {
                    console.warn(`⚠️ ${modelName} is ${isOverloaded ? 'overloaded' : 'rate limited'} (attempt ${attempt}/${maxRetries})`);

                    if (attempt < maxRetries) {
                        // Exponential backoff: 2s, 4s, 8s
                        const delayMs = Math.pow(2, attempt) * 1000;
                        console.log(`Waiting ${delayMs / 1000}s before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    } else {
                        console.warn(`❌ ${modelName} failed after ${maxRetries} attempts, trying next model...`);
                        break; // Try next model
                    }
                } else {
                    // Non-retryable error
                    console.error(`❌ Non-retryable error with ${modelName}:`, error.message);
                    throw error;
                }
            }
        }
    }

    // All models failed
    throw new Error(`All models failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

function parseOutlineText(text: string): OutlineSlide[] {
    const slides: OutlineSlide[] = [];
    const lines = text.split('\n');

    let currentSlide: OutlineSlide | null = null;

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) {
            continue;
        }

        // Skip separator lines (---, ----, etc)
        if (trimmed.match(/^-{2,}$/)) {
            continue;
        }

        // Match various slide formats:
        // - "Slide 1: Title"
        // - "**Slide 1: Title**" (markdown bold)
        // - "Slide 1 - Title"
        // Strip markdown bold markers first
        const cleanedLine = trimmed.replace(/^\*\*|\*\*$/g, '');

        const slideMatch = cleanedLine.match(/^Slide\s+(\d+)[\s:–-]+(.+)/i);

        if (slideMatch) {
            // Save previous slide if exists
            if (currentSlide) {
                slides.push(currentSlide);
            }

            // Start new slide
            currentSlide = {
                slideNumber: parseInt(slideMatch[1]),
                title: slideMatch[2].trim(),
                bulletPoints: [],
            };
        } else if (currentSlide) {
            // Try to capture bullet points in multiple formats:
            // 1. Traditional bullets: "- text" or "• text"
            // 2. Bolded keyword format: "**Keyword**: text" or "**Keyword:** text"
            // 3. Plain text that could be a bullet point

            let bullet = '';

            // Format 1: Traditional bullets
            if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
                bullet = trimmed.replace(/^[-•]\s*/, '').trim();
            }
            // Format 2: Bolded keyword with colon (e.g., "**Economic System**: An organized way...")
            else if (trimmed.match(/^\*\*[^*]+\*\*\s*:/)) {
                bullet = trimmed; // Keep the full formatted text
            }
            // Format 3: Any other non-empty line could be a bullet point
            else {
                bullet = trimmed;
            }

            if (bullet && currentSlide) {
                currentSlide.bulletPoints.push(bullet);
            }
        }
    }

    // Add last slide
    if (currentSlide) {
        slides.push(currentSlide);
    }

    return slides;
}

export function splitOutlineIntoChunks(
    outline: OutlineSlide[],
    chunkSize: number = 60
): OutlineSlide[][] {
    const chunks: OutlineSlide[][] = [];

    for (let i = 0; i < outline.length; i += chunkSize) {
        chunks.push(outline.slice(i, i + chunkSize));
    }

    return chunks;
}

export function convertOutlineToText(slides: OutlineSlide[]): string {
    return slides
        .map((slide) => {
            const bullets = slide.bulletPoints
                .map((bp) => `- ${bp}`)
                .join('\n');
            return `Slide ${slide.slideNumber}: ${slide.title}\n${bullets}`;
        })
        .join('\n\n---\n\n');
}

function formatHierarchicalTopics(hierarchicalTopics: Level1Topic[]): string {
    let formatted = '';

    hierarchicalTopics.forEach((level1, index) => {
        // Level-1 topic
        formatted += `${index + 1}. ${level1.name}\n`;

        // Level-2 topics under this Level-1
        level1.level2Topics.forEach((level2, idx) => {
            formatted += `   ${index + 1}.${idx + 1} ${level2.name}\n`;

            // Level-3 topics under this Level-2
            if (level2.level3Topics.length > 0) {
                level2.level3Topics.forEach((level3) => {
                    formatted += `      • ${level3}\n`;
                });
            }
        });

        formatted += '\n'; // Blank line between Level-1 topics
    });

    return formatted.trim();
}
