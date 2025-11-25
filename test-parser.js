// Test the slide parsing with Gemini's actual format
const sampleGeminiOutput = `Here is a detailed 120-slide presentation outline.

**Slide 1: Title Slide**
- UNIT 2: NATIONAL INCOME ACCOUNTING
- Topic 2.1: Measuring the Economy's Performance
- [Your Name/Institution Name]

---

**Slide 2: Introduction - The Big Picture**
- What if we couldn't measure a country's economic health?
- National Income Accounting provides essential tools
- Key metrics and frameworks

---

Slide 3: Learning Objectives
- Understand national income concepts
- Learn measurement methods
- Analyze economic indicators

---`;

function parseOutlineText(text) {
    const slides = [];
    const lines = text.split('\n');
    let currentSlide = null;

    for (const line of lines) {
        const trimmed = line.trim();
        const cleanedLine = trimmed.replace(/^\*\*|\*\*$/g, '');
        const slideMatch = cleanedLine.match(/^Slide\s+(\d+)[\s:–-]+(.+)/i);

        if (slideMatch) {
            if (currentSlide) {
                slides.push(currentSlide);
            }
            currentSlide = {
                slideNumber: parseInt(slideMatch[1]),
                title: slideMatch[2].trim(),
                bulletPoints: [],
            };
        } else if (currentSlide && (trimmed.startsWith('-') || trimmed.startsWith('•'))) {
            const bullet = trimmed.replace(/^[-•]\s*/, '').trim();
            if (bullet && currentSlide) {
                currentSlide.bulletPoints.push(bullet);
            }
        }
    }

    if (currentSlide) {
        slides.push(currentSlide);
    }

    return slides;
}

console.log('=== TESTING SLIDE PARSER ===\n');
const parsed = parseOutlineText(sampleGeminiOutput);

console.log(`Parsed ${parsed.length} slides:\n`);
parsed.forEach(slide => {
    console.log(`Slide ${slide.slideNumber}: ${slide.title}`);
    console.log(`  Bullets: ${slide.bulletPoints.length}`);
    slide.bulletPoints.forEach(bp => console.log(`    - ${bp}`));
    console.log('');
});

if (parsed.length === 3) {
    console.log('✅ PARSER WORKS! It correctly parsed all 3 slides.');
} else {
    console.log(`❌ PARSER FAILED! Expected 3 slides, got ${parsed.length}`);
}
