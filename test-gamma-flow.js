// Test the complete flow: Parse → Convert → Send to Gamma format

const sampleGeminiOutput = `**Slide 1: Introduction to Economics**
- Definition of economics
- Key concepts
- Importance in daily life

---

**Slide 2: Supply and Demand**
- Law of supply
- Law of demand
- Market equilibrium

---

**Slide 3: Economic Systems**
- Market economy
- Command economy
- Mixed economy`;

// Simulate parsing
function parseOutlineText(text) {
    const slides = [];
    const lines = text.split('\n');
    let currentSlide = null;

    for (const line of lines) {
        const trimmed = line.trim();
        const cleanedLine = trimmed.replace(/^\*\*|\*\*$/g, '');
        const slideMatch = cleanedLine.match(/^Slide\s+(\d+)[\s:–-]+(.+)/i);

        if (slideMatch) {
            if (currentSlide) slides.push(currentSlide);
            currentSlide = {
                slideNumber: parseInt(slideMatch[1]),
                title: slideMatch[2].trim(),
                bulletPoints: [],
            };
        } else if (currentSlide && (trimmed.startsWith('-') || trimmed.startsWith('•'))) {
            // Skip separator lines (---, ----, etc)
            if (trimmed.match(/^-{2,}$/)) {
                continue;
            }

            const bullet = trimmed.replace(/^[-•]\s*/, '').trim();
            if (bullet && currentSlide) {
                currentSlide.bulletPoints.push(bullet);
            }
        }
    }
    if (currentSlide) slides.push(currentSlide);
    return slides;
}

// Simulate convertOutlineToText
function convertOutlineToText(slides) {
    return slides
        .map((slide) => {
            const bullets = slide.bulletPoints
                .map((bp) => `- ${bp}`)
                .join('\n');
            return `Slide ${slide.slideNumber}: ${slide.title}\n${bullets}`;
        })
        .join('\n\n---\n\n');
}

console.log('=== TESTING COMPLETE FLOW ===\n');

// Step 1: Parse
const parsed = parseOutlineText(sampleGeminiOutput);
console.log(`Step 1: Parsed ${parsed.length} slides\n`);

// Step 2: Convert to text
const textForGamma = convertOutlineToText(parsed);
console.log('Step 2: Converted to Gamma format:\n');
console.log('---');
console.log(textForGamma);
console.log('---\n');

// Step 3: Simulate Gamma API payload
const gammaPayload = {
    inputText: textForGamma,
    textMode: 'generate',
    format: 'presentation',
    numCards: parsed.length
};

console.log('Step 3: Gamma API payload:\n');
console.log(JSON.stringify(gammaPayload, null, 2));
console.log('\n✅ This is what Gamma receives!');
