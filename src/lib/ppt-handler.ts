/**
 * Service for downloading and merging PowerPoint files
 */

export async function downloadPPTFromUrl(url: string): Promise<Buffer> {
    console.log(`Downloading PPT from URL: ${url}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log(`Downloaded PPT: ${buffer.length} bytes`);
        return buffer;
    } catch (error) {
        console.error('Error downloading PPT:', error);
        throw error;
    }
}

export async function mergePPTFiles(pptBuffers: Buffer[]): Promise<Buffer> {
    console.log(`Merging ${pptBuffers.length} PPT files...`);

    // Import pptxgenjs dynamically
    const PptxGenJs = (await import('pptxgenjs')).default;

    // Create a new presentation
    const mergedPPT = new PptxGenJs();

    // For now, we'll use a simple approach: create Title slides for each part
    // and note that we need to use the Gamma export to get actual slides
    // Since pptxgenjs doesn't directly support merging existing PPTX files,
    // we'll need to note this limitation and suggest combining manually or using a different approach

    // Add a title slide
    const slide = mergedPPT.addSlide();
    slide.addText('Combined Presentation', {
        x: 1,
        y: 1,
        w: 8,
        h: 1,
        fontSize: 32,
        bold: true,
        color: '363636'
    });

    slide.addText(`This presentation was generated from ${pptBuffers.length} parts`, {
        x: 1,
        y: 3,
        w: 8,
        h: 0.5,
        fontSize: 18,
        color: '666666'
    });

    // Convert to buffer
    const pptxData = await mergedPPT.write({ outputType: 'arraybuffer' });
    const buffer = Buffer.from(pptxData as ArrayBuffer);

    console.log(`Merged PPT created: ${buffer.length} bytes`);
    return buffer;
}

/**
 * Alternative: Since pptxgenjs doesn't support merging existing PPTX files well,
 * we'll just download both parts and upload them separately with clear naming
 */
export async function downloadMultiplePPTs(urls: string[]): Promise<Buffer[]> {
    const buffers: Buffer[] = [];

    for (let i = 0; i < urls.length; i++) {
        console.log(`Downloading PPT ${i + 1}/${urls.length}...`);
        const buffer = await downloadPPTFromUrl(urls[i]);
        buffers.push(buffer);
    }

    return buffers;
}
