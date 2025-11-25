/**
 * Test script to verify content generation
 * Run with: node test-content-generation.js
 */

// Simulate the convertOutlineToText function
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

// Sample outline (typical structure)
const sampleOutline = [
    {
        slideNumber: 1,
        title: "Introduction to Macroeconomics",
        bulletPoints: [
            "Definition and scope of macroeconomics",
            "Key macroeconomic variables",
            "Difference between micro and macro economics"
        ]
    },
    {
        slideNumber: 2,
        title: "National Income Accounting",
        bulletPoints: [
            "Concept of national income",
            "Methods of measuring national income",
            "GDP vs GNP"
        ]
    },
    {
        slideNumber: 3,
        title: "Economic Indicators",
        bulletPoints: [
            "Leading indicators",
            "Lagging indicators",
            "Coincident indicators"
        ]
    }
];

console.log('=== CONTENT GENERATION TEST ===\n');
console.log(`Sample outline with ${sampleOutline.length} slides\n`);

const generatedText = convertOutlineToText(sampleOutline);

console.log('Generated text length:', generatedText.length, 'characters');
console.log('\nGenerated content:');
console.log('---');
console.log(generatedText);
console.log('---\n');

// Calculate what Gamma will receive for 60 slides
const estimatedFor60Slides = (generatedText.length / sampleOutline.length) * 60;
console.log(`Estimated content for 60 slides: ~${Math.round(estimatedFor60Slides)} characters`);
console.log(`Estimated content for 120 slides: ~${Math.round(estimatedFor60Slides * 2)} characters`);

// Check if it's sufficient
if (estimatedFor60Slides < 1000) {
    console.log('\n⚠️ WARNING: Content may be too short for Gamma!');
    console.log('Gamma typically needs detailed content to generate good presentations.');
} else {
    console.log('\n✅ Content length looks good for Gamma API.');
}
