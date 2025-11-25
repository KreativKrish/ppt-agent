"use client";

import React, { useState } from "react";
import { Input, ParamGroup, Select, TextArea } from "@/components/ParamGroup";
import AutomationPanel from "@/components/AutomationPanel";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"manual" | "automation">("manual");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    apiKey: "",
    inputText: "",
    textMode: "generate",
    format: "presentation",
    themeId: "",
    numCards: 7,
    cardSplit: "auto",
    additionalInstructions: "",
    // Text Options
    textAmount: "medium",
    textTone: "informative",
    textAudience: "general",
    textLanguage: "en",
    // Image Options
    imageSource: "aiGenerated",
    imageModel: "imagen-4-pro",
    imageStyle: "photorealistic",
    // Card Options
    cardDimensions: "fluid",
    // New Params
    exportAs: "",
    folderIds: "",
    // Sharing
    workspaceAccess: "noAccess",
    externalAccess: "noAccess",
    // Header/Footer
    hideFromFirstCard: false,
    hideFromLastCard: false,
    footerText: "",
    showCardNumbers: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev]);
  };

  const saveApiKey = async () => {
    if (!formData.apiKey) return;
    try {
      const response = await fetch("/api/save-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: formData.apiKey }),
      });
      if (response.ok) {
        alert("API Key saved to .env.local! You can now restart the server to use it without entering it here.");
      } else {
        alert("Failed to save API Key.");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving API Key.");
    }
  };

  const pollGenerationStatus = async (generationId: string) => {
    addLog(`Polling status for generation: ${generationId}`);
    const maxAttempts = 60; // 5 minutes max (60 * 5 seconds)
    let attempts = 0;

    const poll = async (): Promise<any> => {
      attempts++;
      addLog(`Polling attempt ${attempts}/${maxAttempts}...`);

      try {
        const response = await fetch(`/api/status/${generationId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to check status");
        }

        addLog(`Status: ${data.status || "unknown"}`);

        if (data.status === "completed") {
          addLog(`✅ Generation completed!`);
          addLog(`Presentation URL: ${data.url || "N/A"}`);
          return data;
        } else if (data.status === "failed") {
          throw new Error(data.error || "Generation failed");
        } else {
          // Still pending, poll again after 5 seconds
          if (attempts >= maxAttempts) {
            throw new Error("Timeout: Generation took too long");
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return poll();
        }
      } catch (err: any) {
        addLog(`Polling error: ${err.message}`);
        throw err;
      }
    };

    return poll();
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    addLog(`Starting generation...`);
    addLog(`Params: ${JSON.stringify({ ...formData, apiKey: formData.apiKey ? "***" : "Using Server Key" }, null, 2)}`);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      addLog(`Response Status: ${response.status}`);
      if (!response.ok) {
        addLog(`Error: ${JSON.stringify(data, null, 2)}`);
        throw new Error(data.error || "Failed to generate presentation");
      }

      addLog(`Success: ${JSON.stringify(data, null, 2)}`);

      // If we got a generationId, poll for status
      if (data.generationId) {
        addLog(`Received generationId: ${data.generationId}`);
        addLog(`Starting to poll for completion...`);
        const finalResult = await pollGenerationStatus(data.generationId);
        setResult(finalResult);
      } else {
        setResult(data);
      }
    } catch (err: any) {
      addLog(`Exception: ${err.message}`);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Gamma PPT Generator</h1>
          <p className="mt-2 text-lg text-gray-700 font-medium">Create stunning presentations from an outline using the Gamma API.</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-gray-300">
          <button
            onClick={() => setActiveTab("manual")}
            className={cn(
              "px-6 py-3 font-medium text-base transition-colors border-b-2",
              activeTab === "manual"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            )}
          >
            Manual Generation
          </button>
          <button
            onClick={() => setActiveTab("automation")}
            className={cn(
              "px-6 py-3 font-medium text-base transition-colors border-b-2",
              activeTab === "automation"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            )}
          >
            Automated Pipeline
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "automation" ? (
          <AutomationPanel />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* API Key Section */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-300">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Input
                    label="Gamma API Key"
                    name="apiKey"
                    type="password"
                    placeholder="Enter your Gamma API Key (Leave empty if configured on server)"
                    value={formData.apiKey}
                    onChange={handleChange}
                  />
                </div>
                <button
                  type="button"
                  onClick={saveApiKey}
                  className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 text-sm font-medium h-10 mb-0.5"
                >
                  Save to Env
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Your API key is sent securely to the server and not stored. If the server has an API key configured, this field is optional.
              </p>
            </div>

            {/* Core Content Section */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-300 space-y-6">
              <TextArea
                label="Presentation Outline / Content"
                name="inputText"
                placeholder="Enter your outline, notes, or topic here..."
                value={formData.inputText}
                onChange={handleChange}
                className="min-h-[200px] text-base"
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select
                  label="Text Mode"
                  name="textMode"
                  value={formData.textMode}
                  onChange={handleChange}
                  options={[
                    { value: "generate", label: "Generate (Rewrite & Expand)" },
                    { value: "condense", label: "Condense (Summarize)" },
                    { value: "preserve", label: "Preserve (Keep as is)" },
                  ]}
                />
                <Select
                  label="Format"
                  name="format"
                  value={formData.format}
                  onChange={handleChange}
                  options={[
                    { value: "presentation", label: "Presentation" },
                    { value: "document", label: "Document" },
                    { value: "social", label: "Social" },
                  ]}
                />
              </div>
            </div>

            {/* Advanced Parameters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ParamGroup title="General Settings">
                <Input
                  label="Theme ID (Optional)"
                  name="themeId"
                  placeholder="e.g., theme-id-123"
                  value={formData.themeId}
                  onChange={handleChange}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Number of Cards"
                    name="numCards"
                    type="number"
                    value={formData.numCards}
                    onChange={handleChange}
                  />
                  <Select
                    label="Card Split"
                    name="cardSplit"
                    value={formData.cardSplit}
                    onChange={handleChange}
                    options={[
                      { value: "auto", label: "Auto (uses numCards)" },
                      { value: "inputTextBreaks", label: "Input Text Breaks (\\n---\\n)" },
                    ]}
                  />
                </div>
                <TextArea
                  label="Additional Instructions"
                  name="additionalInstructions"
                  placeholder="e.g., Make it professional..."
                  value={formData.additionalInstructions}
                  onChange={handleChange}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Export As"
                    name="exportAs"
                    value={formData.exportAs}
                    onChange={handleChange}
                    options={[
                      { value: "", label: "None" },
                      { value: "pdf", label: "PDF" },
                      { value: "pptx", label: "PowerPoint (PPTX)" },
                    ]}
                  />
                  <Input
                    label="Folder IDs (Comma separated)"
                    name="folderIds"
                    placeholder="id1, id2"
                    value={formData.folderIds}
                    onChange={handleChange}
                  />
                </div>
              </ParamGroup>

              <ParamGroup title="Text Options">
                <Select
                  label="Amount"
                  name="textAmount"
                  value={formData.textAmount}
                  onChange={handleChange}
                  options={[
                    { value: "brief", label: "Brief" },
                    { value: "medium", label: "Medium" },
                    { value: "detailed", label: "Detailed" },
                    { value: "extensive", label: "Extensive" },
                  ]}
                />
                <Select
                  label="Tone"
                  name="textTone"
                  value={formData.textTone}
                  onChange={handleChange}
                  options={[
                    { value: "informative", label: "Informative" },
                    { value: "professional", label: "Professional" },
                    { value: "casual", label: "Casual" },
                    { value: "inspiring", label: "Inspiring" },
                  ]}
                />
                <Input
                  label="Audience"
                  name="textAudience"
                  placeholder="e.g., Investors, Students"
                  value={formData.textAudience}
                  onChange={handleChange}
                />
                <Input
                  label="Language"
                  name="textLanguage"
                  placeholder="e.g., en, es, fr"
                  value={formData.textLanguage}
                  onChange={handleChange}
                />
              </ParamGroup>

              <ParamGroup title="Image Options">
                <Select
                  label="Source"
                  name="imageSource"
                  value={formData.imageSource}
                  onChange={handleChange}
                  options={[
                    { value: "aiGenerated", label: "AI Generated" },
                    { value: "unsplash", label: "Unsplash" },
                    { value: "webImages", label: "Web Images" },
                    { value: "pictographic", label: "Pictographic" },
                    { value: "noImages", label: "No Images" },
                  ]}
                />
                {formData.imageSource === "aiGenerated" && (
                  <>
                    <Input
                      label="Model"
                      name="imageModel"
                      value={formData.imageModel}
                      onChange={handleChange}
                    />
                    <Input
                      label="Style"
                      name="imageStyle"
                      value={formData.imageStyle}
                      onChange={handleChange}
                    />
                  </>
                )}
              </ParamGroup>

              <ParamGroup title="Card Options">
                <Select
                  label="Dimensions"
                  name="cardDimensions"
                  value={formData.cardDimensions}
                  onChange={handleChange}
                  options={[
                    { value: "fluid", label: "Fluid" },
                    { value: "fixed", label: "Fixed" },
                  ]}
                />
                <div className="space-y-2 mt-2">
                  <label className="text-sm font-bold text-gray-900">Header & Footer</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="hideFromFirstCard"
                      checked={formData.hideFromFirstCard}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-sm font-medium text-gray-800">Hide from first card</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="hideFromLastCard"
                      checked={formData.hideFromLastCard}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-sm font-medium text-gray-800">Hide from last card</span>
                  </div>
                  <Input
                    label="Footer Text (Bottom Center)"
                    name="footerText"
                    value={formData.footerText}
                    onChange={handleChange}
                  />
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      name="showCardNumbers"
                      checked={formData.showCardNumbers}
                      onChange={handleChange}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-sm font-medium text-gray-800">Show Card Numbers</span>
                  </div>
                </div>
              </ParamGroup>

              <ParamGroup title="Sharing Options">
                <Select
                  label="Workspace Access"
                  name="workspaceAccess"
                  value={formData.workspaceAccess}
                  onChange={handleChange}
                  options={[
                    { value: "noAccess", label: "No Access" },
                    { value: "view", label: "View" },
                    { value: "comment", label: "Comment" },
                    { value: "edit", label: "Edit" },
                    { value: "fullAccess", label: "Full Access" },
                  ]}
                />
                <Select
                  label="External Access"
                  name="externalAccess"
                  value={formData.externalAccess}
                  onChange={handleChange}
                  options={[
                    { value: "noAccess", label: "No Access" },
                    { value: "view", label: "View" },
                    { value: "comment", label: "Comment" },
                    { value: "edit", label: "Edit" },
                  ]}
                />
              </ParamGroup>
            </div>

            <div className="flex justify-end pt-6">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                    Generating...
                  </>
                ) : (
                  "Generate Presentation"
                )}
              </button>
            </div>

            {/* Logs Section */}
            <div className="mt-8 bg-gray-900 rounded-lg shadow-lg overflow-hidden border border-gray-700">
              <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-sm font-mono text-gray-300">Terminal Logs</h3>
                <button onClick={() => setLogs([])} className="text-xs text-gray-400 hover:text-white">Clear</button>
              </div>
              <div className="p-4 h-64 overflow-y-auto font-mono text-xs text-green-400 whitespace-pre-wrap">
                {logs.length === 0 ? (
                  <span className="text-gray-500">Waiting for logs...</span>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="mb-1 border-b border-gray-800 pb-1 last:border-0">{log}</div>
                  ))
                )}
              </div>
            </div>

            {error && (
              <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <h3 className="font-bold mb-1">Error</h3>
                <p>{error}</p>
              </div>
            )}

            {result && (
              <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg text-green-800">
                <h3 className="text-xl font-bold mb-4">Presentation Generated Successfully!</h3>
                <div className="bg-white p-4 rounded border border-green-100 overflow-auto">
                  <pre className="text-sm text-gray-800">{JSON.stringify(result, null, 2)}</pre>
                </div>
                {result.url && (
                  <div className="mt-4">
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Open Presentation
                    </a>
                  </div>
                )}
              </div>
            )}
          </form>
        )}
      </div>
    </main >
  );
}
