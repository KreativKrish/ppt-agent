"use client";

import React, { useState } from "react";
import { Input, TextArea, Select } from "./ParamGroup";
import { Loader2, CheckCircle, XCircle, ExternalLink, ArrowLeft } from "lucide-react";
import { extractDriveId } from "@/lib/drive-url-parser";
import ManualGenerationPanel from "./ManualGenerationPanel";

interface AutomationResult {
    unit: string;
    parts?: Array<{
        part: number;
        url?: string;
        status: string;
    }>;
    status: string;
    error?: string;
}

interface GammaTheme {
    id: string;
    name: string;
    type: 'standard' | 'custom';
    colorKeywords?: string[];
    toneKeywords?: string[];
}

const IMAGE_SOURCE_OPTIONS = [
    { value: "noImages", label: "No Images (Default)" },
    { value: "aiGenerated", label: "AI Generated" },
    { value: "unsplash", label: "Unsplash" },
    { value: "giphy", label: "Giphy" },
    { value: "webAllImages", label: "Web (All Images)" },
    { value: "webFreeToUse", label: "Web (Free to Use)" },
    { value: "webFreeToUseCommercially", label: "Web (Free to Use Commercially)" },
    { value: "placeholder", label: "Placeholder" },
];

const IMAGE_MODEL_OPTIONS = [
    { value: "", label: "Auto (Default)" },
    { value: "flux-1-quick", label: "Flux 1 Quick" },
    { value: "flux-1-pro", label: "Flux 1 Pro" },
    { value: "dall-e-3", label: "DALL-E 3" },
    { value: "imagen-3-flash", label: "Imagen 3 Flash" },
    { value: "imagen-3-pro", label: "Imagen 3 Pro" },
    { value: "imagen-4-pro", label: "Imagen 4 Pro" },
    { value: "imagen-4-ultra", label: "Imagen 4 Ultra" },
    { value: "ideogram-v3-turbo", label: "Ideogram v3 Turbo" },
    { value: "ideogram-v3", label: "Ideogram v3" },
    { value: "ideogram-v3-quality", label: "Ideogram v3 Quality" },
];

//Generate a {slideCount}-slide presentation outline with:
// Unit: {unitName}
// Topics (Level-1): {level1Topics}
// Subtopics (Level-2): {level2Topics}
// SubSubTopics (Level-3): {level3Topics}

// Sole Source for Topics: Use the provided level-1, level-2, and level-3 topics as the one and only source for this task.

const DEFAULT_PROMPT = `Please create a comprehensive and detailed set of presentation slides for the university course unit titled {unitName}.
Generate a {slideCount}-slide presentation outline.

HIERARCHICAL TOPIC STRUCTURE (FOLLOW THIS ORDER STRICTLY):
{hierarchicalTopics}


CRITICAL INSTRUCTIONS FOR TOPIC COVERAGE:
1. **Follow the Hierarchical Order**: You MUST cover topics in the exact order shown above.
2. **Complete Each Level-1 Before Moving On**: For each Level-1 topic:
   - First, cover all its Level-2 subtopics in order
   - For each Level-2 subtopic, cover all its related Level-3 details
   - Only after fully completing one Level-1 topic and all its children, move to the next Level-1 topic
3. **Use the Hierarchical Structure as Your Only Source**: The hierarchical topic structure above is your complete and only source for this task.

Content Generation Instructions:
• **Internal Knowledge**: You must generate all detailed content for the slides using your own internal, general knowledge of the subject matter. No Self-Learning Material (SLM) or other external document is provided.
• **Comprehensive Coverage**: For each Level-2 subtopic, create slides that thoroughly explain all the Level-3 details listed under it. Ensure the explanations are accurate and at a university level.
• **Enhancements**: It is essential that you enhance the content with relevant examples, clear analogies, simple tables, mathematical formulas, or code snippets to illustrate and clarify complex concepts.

Structural Requirements:
1. **Slide Distribution**: Distribute the {slideCount} slides evenly across all Level-1 topics, ensuring each gets proportional coverage.
2. **No Summaries**: Do not create a summary slide at the end of each major section.
3. **Sequential Coverage**: Move through Level-1 → Level-2 → Level-3 in sequential order without jumping between sections.

STRICT FORMATTING REQUIREMENTS (MANDATORY - DO NOT SKIP):
1. Slide Format: Every slide MUST be formatted EXACTLY as follows:
   - A heading line with a continuous slide number and a descriptive title (e.g., **Slide 1: [Topic]**)
   - EXACTLY THREE (3) bullet points - THIS IS MANDATORY, NOT OPTIONAL
   - Each bullet point MUST begin with a bolded keyword or phrase, followed by a colon, then explanatory text
   - The text after the colon must be a single, concise explanatory sentence

EXAMPLE FORMAT (follow this exactly):
Slide 1: Introduction to Economic Systems
- **Market Economy**: A system where prices are determined by supply and demand with minimal government intervention.
- **Command Economy**: An economic system where the government controls production, prices, and distribution of goods.
- **Mixed Economy**: A system that combines elements of both market and command economies for balanced growth.

---

2. Separators: Use \\n---\\n to separate each slide.
3. No Citations: Absolutely no citations are allowed in the response.

IMPORTANT: Each slide MUST have exactly 3 bullet points. Do not create slides with only titles. Every slide needs content.`;

const DEFAULT_GAMMA_ADDITIONAL_INSTRUCTIONS = `All slide titles should use Heading 2 font size.
All content except titles should use Large font size.

Use only the following slide layouts, cycling through them in order:
- Solid box layout (no images)
- Side box layout (no images)
- Bullet list layout (no images)
- Hollow box layout (no images) 
- Arrows layout (no images)
- Two column layout (image on left, bullet points on right)

Do not use any other layouts.
All cards should have vertical orientation with extra large column size.`;

export default function AutomationPanel() {
    const [googleTokens, setGoogleTokens] = useState<string | null>(null);
    const [driveFileId, setDriveFileId] = useState("");
    const [driveFolderId, setDriveFolderId] = useState("");
    const [gammaFolderId, setGammaFolderId] = useState("");
    const [gammaAdditionalInstructions, setGammaAdditionalInstructions] = useState(DEFAULT_GAMMA_ADDITIONAL_INSTRUCTIONS);
    const [slidesPerUnit, setSlidesPerUnit] = useState(10);
    const [geminiApiKey, setGeminiApiKey] = useState("");
    const [customPrompt, setCustomPrompt] = useState(DEFAULT_PROMPT);
    const [imageSource, setImageSource] = useState("noImages");
    const [imageModel, setImageModel] = useState("");
    const [themes, setThemes] = useState<GammaTheme[]>([]);
    const [selectedThemeId, setSelectedThemeId] = useState("");
    const [themeSearchQuery, setThemeSearchQuery] = useState("");
    const [isLoadingThemes, setIsLoadingThemes] = useState(false);
    const [showThemeDropdown, setShowThemeDropdown] = useState(false);

    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState("");
    const [results, setResults] = useState<AutomationResult[]>([]);
    const [error, setError] = useState("");
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
    const [currentView, setCurrentView] = useState<"automation" | "manual">("automation");

    // Load results from localStorage on mount
    React.useEffect(() => {
        const savedResults = localStorage.getItem('automation_results');
        if (savedResults) {
            try {
                setResults(JSON.parse(savedResults));
            } catch (e) {
                console.error('Failed to load saved results:', e);
            }
        }
    }, []);

    // Save results to localStorage whenever they change
    React.useEffect(() => {
        if (results.length > 0) {
            localStorage.setItem('automation_results', JSON.stringify(results));
        }
    }, [results]);

    // Load tokens from localStorage on mount
    React.useEffect(() => {
        const savedTokens = localStorage.getItem('google_drive_tokens');
        if (savedTokens) {
            setGoogleTokens(savedTokens);
        }
    }, []);

    // Fetch themes from API on mount
    React.useEffect(() => {
        const fetchThemes = async () => {
            setIsLoadingThemes(true);
            try {
                const response = await fetch('/api/themes');
                if (response.ok) {
                    const data = await response.json();
                    setThemes(data.data || []);
                } else {
                    console.error('Failed to fetch themes');
                }
            } catch (error) {
                console.error('Error fetching themes:', error);
            } finally {
                setIsLoadingThemes(false);
            }
        };
        fetchThemes();
    }, []);

    // Close theme dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (showThemeDropdown && !target.closest('.theme-dropdown-container')) {
                setShowThemeDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showThemeDropdown]);

    // Save tokens to localStorage whenever they change
    React.useEffect(() => {
        if (googleTokens) {
            localStorage.setItem('google_drive_tokens', googleTokens);
        }
    }, [googleTokens]);

    const handleGoogleAuth = async () => {
        setIsAuthenticating(true);
        try {
            const response = await fetch("/api/auth/google");
            const data = await response.json();

            if (data.authUrl) {
                // Open auth URL in new window
                window.open(data.authUrl, "_blank");
                setProgress("Please complete authentication in the new window...");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsAuthenticating(false);
        }
    };

    const saveGeminiKey = async () => {
        if (!geminiApiKey) return;
        try {
            const response = await fetch("/api/save-key", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiKey: geminiApiKey }),
            });
            if (response.ok) {
                alert("Gemini API Key saved to .env.local!");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const startAutomation = async () => {
        if (!driveFileId || !customPrompt) {
            setError("Please fill in all required fields");
            return;
        }

        if (!googleTokens) {
            setError("Please authenticate with Google Drive first");
            return;
        }

        setIsRunning(true);
        setError("");
        setResults([]);
        setProgress("Starting automation...");

        try {
            // Extract IDs from URLs automatically
            const extractedFileId = extractDriveId(driveFileId);
            const extractedDriveFolderId = extractDriveId(driveFolderId);
            const extractedGammaFolderId = gammaFolderId; // Gamma folder IDs are not URLs

            const response = await fetch("/api/automate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    driveFileId: extractedFileId,
                    driveFolderId: extractedDriveFolderId,
                    gammaFolderId: extractedGammaFolderId,
                    gammaAdditionalInstructions,
                    slidesPerUnit,
                    googleTokens: JSON.parse(googleTokens),
                    geminiApiKey,
                    customPrompt,
                    imageSource,
                    imageModel,
                    themeId: selectedThemeId,
                }),
            });

            if (!response.ok || !response.body) {
                throw new Error("Failed to start automation");
            }

            // Read streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const resultsMap = new Map<string, any>();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            switch (data.type) {
                                case 'progress':
                                    setProgress(data.message);
                                    break;

                                case 'part_complete':
                                    // Add or update unit in results
                                    const existing = resultsMap.get(data.unit);
                                    if (existing) {
                                        existing.parts.push(data.part);
                                    } else {
                                        resultsMap.set(data.unit, {
                                            unit: data.unit,
                                            status: 'in_progress',
                                            parts: [data.part]
                                        });
                                    }
                                    // Update results array immediately
                                    setResults(Array.from(resultsMap.values()));
                                    break;

                                case 'unit_complete':
                                    resultsMap.set(data.unit, {
                                        unit: data.unit,
                                        status: data.status,
                                        parts: data.parts
                                    });
                                    setResults(Array.from(resultsMap.values()));
                                    break;

                                case 'unit_error':
                                    resultsMap.set(data.unit, {
                                        unit: data.unit,
                                        status: 'error',
                                        error: data.error
                                    });
                                    setResults(Array.from(resultsMap.values()));
                                    break;

                                case 'complete':
                                    setProgress(data.message);
                                    break;

                                case 'error':
                                    setError(data.message);
                                    break;
                            }
                        } catch (e) {
                            console.error('Failed to parse streaming data:', e);
                        }
                    }
                }
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsRunning(false);
        }
    };

    // Check for auth callback
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const authStatus = params.get("auth");
        const tokens = params.get("tokens");

        if (authStatus === "success" && tokens) {
            setGoogleTokens(decodeURIComponent(tokens));
            setProgress("Google Drive authenticated successfully!");
            // Clean up URL
            window.history.replaceState({}, "", window.location.pathname);
        } else if (authStatus === "error") {
            const message = params.get("message");
            setError(`Authentication failed: ${message}`);
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, []);

    return (
        <div className="space-y-6">
            {currentView === "manual" ? (
                <>
                    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-300">
                        <button
                            onClick={() => setCurrentView("automation")}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors font-medium text-sm mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Automation Pipeline
                        </button>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Manual Generation</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Generate presentations from custom outlines using the Gamma API.
                        </p>
                    </div>
                    <ManualGenerationPanel />
                </>
            ) : (
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-300">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Automated ToC-to-PPT Pipeline</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Upload an Excel ToC to Google Drive, and this tool will automatically generate presentations for each unit.
                    </p>

                    {/* Google Drive Auth */}
                    <div className="mb-6">
                        <label className="text-sm font-bold text-gray-800 block mb-2">Google Drive Authentication</label>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleGoogleAuth}
                                disabled={isAuthenticating || !!googleTokens}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                            >
                                {isAuthenticating ? (
                                    <>
                                        <Loader2 className="animate-spin inline mr-2 h-4 w-4" />
                                        Authenticating...
                                    </>
                                ) : googleTokens ? (
                                    <>
                                        <CheckCircle className="inline mr-2 h-4 w-4" />
                                        Authenticated
                                    </>
                                ) : (
                                    "Connect Google Drive"
                                )}
                            </button>
                            {googleTokens && (
                                <span className="text-sm text-green-600">✓ Ready to access Drive</span>
                            )}
                        </div>
                    </div>



                    {/* File IDs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <Input
                                label="Excel ToC File (Link or ID)"
                                name="driveFileId"
                                placeholder="Paste Drive link or ID: https://drive.google.com/file/d/..."
                                value={driveFileId}
                                onChange={(e) => setDriveFileId(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Paste full Google Drive link or just the file ID
                            </p>
                        </div>
                        <div>
                            <Input
                                label="Google Drive Folder for Gamma links (Link or ID)"
                                name="driveFolderId"
                                placeholder="Paste Drive folder link: https://drive.google.com/drive/folders/..."
                                value={driveFolderId}
                                onChange={(e) => setDriveFolderId(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                For Gamma links tracking - paste folder link or ID
                            </p>
                            <Input
                                label="Gamma Folder ID"
                                name="gammaFolderId"
                                placeholder="e.g. 8a9b0c..."
                                value={gammaFolderId}
                                onChange={(e) => setGammaFolderId(e.target.value)}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Organize presentations in a specific Gamma folder
                            </p>
                        </div>
                    </div>

                    {/* Advanced Options Toggle Button */}
                    <div className="mb-6">
                        <button
                            type="button"
                            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors font-medium text-sm"
                        >
                            <svg
                                className={`w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            Advanced Options
                            {!showAdvancedOptions && (
                                <span className="text-xs text-gray-500">(Slides, Theme, Images, Prompts)</span>
                            )}
                        </button>
                    </div>

                    {/* Advanced Options Section */}
                    {showAdvancedOptions && (
                        <div className="space-y-6 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Advanced Options</h3>

                            {/* Slides per Unit and Theme */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Input
                                        label="Slides per Unit"
                                        name="slidesPerUnit"
                                        type="number"
                                        placeholder="e.g. 10, 60, 120"
                                        value={slidesPerUnit.toString()}
                                        onChange={(e) => setSlidesPerUnit(parseInt(e.target.value) || 10)}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Number of slides Gemini will generate for each unit
                                    </p>
                                </div>
                                <div>
                                    {/* Searchable Theme Selector */}
                                    <div className="relative theme-dropdown-container">
                                        <label className="text-sm font-bold text-gray-800 block mb-2">
                                            Gamma Theme (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={isLoadingThemes ? "Loading themes..." : "Search themes..."}
                                            value={themeSearchQuery}
                                            onChange={(e) => {
                                                setThemeSearchQuery(e.target.value);
                                                setShowThemeDropdown(true);
                                            }}
                                            onFocus={() => setShowThemeDropdown(true)}
                                            disabled={isLoadingThemes}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-gray-900"
                                        />

                                        {/* Display selected theme name */}
                                        {selectedThemeId && !showThemeDropdown && (
                                            <div className="mt-1 text-xs text-gray-600">
                                                Selected: {themes.find(t => t.id === selectedThemeId)?.name || 'Unknown'}
                                            </div>
                                        )}

                                        {/* Dropdown with filtered themes */}
                                        {showThemeDropdown && themes.length > 0 && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                {/* Clear selection option */}
                                                <div
                                                    onClick={() => {
                                                        setSelectedThemeId("");
                                                        setThemeSearchQuery("");
                                                        setShowThemeDropdown(false);
                                                    }}
                                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                                                >
                                                    <span className="text-sm text-gray-600">No theme (Default)</span>
                                                </div>

                                                {themes
                                                    .filter(theme =>
                                                        theme.name.toLowerCase().includes(themeSearchQuery.toLowerCase())
                                                    )
                                                    .map(theme => (
                                                        <div
                                                            key={theme.id}
                                                            onClick={() => {
                                                                setSelectedThemeId(theme.id);
                                                                setThemeSearchQuery(theme.name);
                                                                setShowThemeDropdown(false);
                                                            }}
                                                            className={`px-3 py-2 hover:bg-indigo-50 cursor-pointer ${selectedThemeId === theme.id ? 'bg-indigo-100' : ''
                                                                }`}
                                                        >
                                                            <div className="text-sm font-medium text-gray-900">{theme.name}</div>
                                                            <div className="text-xs text-gray-500 capitalize">{theme.type}</div>
                                                        </div>
                                                    ))
                                                }
                                                {themes.filter(theme =>
                                                    theme.name.toLowerCase().includes(themeSearchQuery.toLowerCase())
                                                ).length === 0 && (
                                                        <div className="px-3 py-2 text-sm text-gray-500">
                                                            No themes found
                                                        </div>
                                                    )}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Choose a theme for your presentations
                                    </p>
                                </div>
                            </div>

                            {/* Image Options */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Select
                                        label="Image Source"
                                        name="imageSource"
                                        options={IMAGE_SOURCE_OPTIONS}
                                        value={imageSource}
                                        onChange={(e) => setImageSource(e.target.value)}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Choose where to source images for your presentation
                                    </p>
                                </div>
                                {imageSource === 'aiGenerated' && (
                                    <div>
                                        <Select
                                            label="Image Model"
                                            name="imageModel"
                                            options={IMAGE_MODEL_OPTIONS}
                                            value={imageModel}
                                            onChange={(e) => setImageModel(e.target.value)}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            AI model to use for image generation
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Gamma Additional Instructions */}
                            <div className="mb-6">
                                <TextArea
                                    label="Gamma Additional Instructions (Optional)"
                                    name="gammaAdditionalInstructions"
                                    placeholder="e.g., Make the card headings humorous and catchy, Use vibrant colors, etc."
                                    value={gammaAdditionalInstructions}
                                    onChange={(e) => setGammaAdditionalInstructions(e.target.value)}
                                    rows={3}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Add specifications to steer Gamma's content, layouts, and design. See{" "}
                                    <a
                                        href="https://developers.gamma.app/docs/generate-api-parameters-explained#additionalinstructions-optional"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:underline"
                                    >
                                        Gamma docs
                                    </a>
                                    {" "}for examples.
                                </p>
                            </div>

                            {/* Gemini API Key */}
                            <div className="mb-6">
                                <div className="flex items-end gap-4">
                                    <div className="flex-1">
                                        <Input
                                            label="Gemini API Key (Optional)"
                                            name="geminiApiKey"
                                            type="password"
                                            placeholder="Leave empty if saved in .env"
                                            value={geminiApiKey}
                                            onChange={(e) => setGeminiApiKey(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={saveGeminiKey}
                                        className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 text-sm font-medium h-10 mb-0.5"
                                    >
                                        Save to Env
                                    </button>
                                </div>
                            </div>

                            {/* Custom Prompt */}
                            <div className="mb-6">
                                <TextArea
                                    label="Outline Generation Prompt"
                                    name="customPrompt"
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    className="min-h-[200px] font-mono text-xs"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Use placeholders: {"{unitName}"}, {"{level1Topics}"}, {"{level2Topics}"}, {"{slideCount}"}
                                </p>
                            </div>

                            {/* Manual Generation Button */}
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setCurrentView("manual")}
                                    className="w-full px-4 py-3 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors font-medium text-sm"
                                >
                                    Switch to Manual Generation
                                </button>
                                <p className="text-xs text-gray-500 mt-2">
                                    Generate presentations manually from custom outlines without automation
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Start Button */}
                    <button
                        onClick={startAutomation}
                        disabled={isRunning || !googleTokens}
                        className="w-full px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 className="animate-spin inline mr-2 h-5 w-5" />
                                Processing...
                            </>
                        ) : (
                            "Start Automation"
                        )}
                    </button>

                    {/* Progress */}
                    {progress && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                            {progress}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {/* Results */}
                    {results.length > 0 && (
                        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-300">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-900">Results</h3>
                                <button
                                    onClick={() => {
                                        setResults([]);
                                        localStorage.removeItem('automation_results');
                                    }}
                                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                                >
                                    Clear Results
                                </button>
                            </div>
                            <div className="space-y-4">
                                {results.map((result, idx) => (
                                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold text-gray-900">{result.unit}</h4>
                                            {result.status === "completed" ? (
                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-600" />
                                            )}
                                        </div>

                                        {result.parts && (
                                            <div className="space-y-2">
                                                <p className="text-xs text-gray-600 mb-2">Generated presentations:</p>
                                                {result.parts.map((part: any) => (
                                                    <div key={part.partNumber} className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded border border-gray-200">
                                                        <span className="text-gray-700 font-medium">{part.partName}</span>
                                                        <div className="flex gap-2">
                                                            {part.downloadUrl ? (
                                                                <a
                                                                    href={part.downloadUrl}
                                                                    download={`${part.partName}.pptx`}
                                                                    className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1 font-medium text-xs"
                                                                >
                                                                    Download PPTX
                                                                    <ExternalLink className="h-3 w-3" />
                                                                </a>
                                                            ) : (
                                                                <a
                                                                    href={part.gammaUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium text-xs"
                                                                >
                                                                    Open in Gamma
                                                                    <ExternalLink className="h-3 w-3" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {result.parts.some((p: any) => !p.downloadUrl) && (
                                                    <p className="text-xs text-gray-500 mt-2">💡 Tip: For presentations without download links, open in Gamma and use "..." → Export → PowerPoint</p>
                                                )}
                                            </div>
                                        )}

                                        {result.error && (
                                            <p className="text-sm text-red-600 mt-2">Error: {result.error}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
