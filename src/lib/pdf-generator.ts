import puppeteer from 'puppeteer';

export async function generatePDFFromUrl(url: string): Promise<Buffer> {
    console.log(`Generating PDF from URL: ${url}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set viewport to standard presentation size
        await page.setViewport({ width: 1920, height: 1080 });

        // Navigate to URL and wait for network idle
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait a bit more for any animations or lazy loading
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });

        console.log('PDF generated successfully');
        return Buffer.from(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    } finally {
        await browser.close();
    }
}
