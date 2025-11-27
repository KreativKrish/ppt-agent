"use client";

import React, { useState } from "react";
import { Loader2, RefreshCw, CheckCircle, XCircle } from "lucide-react";

interface UpdateResult {
    name: string;
    status: string;
    url: string;
}

interface ManualUpdatePanelProps {
    googleTokens: string | null;
}

export default function ManualUpdatePanel({ googleTokens }: ManualUpdatePanelProps) {
    const [spreadsheetId, setSpreadsheetId] = useState("");
    const [isChecking, setIsChecking] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [results, setResults] = useState<UpdateResult[]>([]);

    const handleCheckPending = async () => {
        if (!spreadsheetId) {
            setError("Please enter a spreadsheet ID or URL");
            return;
        }

        if (!googleTokens) {
            setError("Please authenticate with Google Drive first");
            return;
        }

        setIsChecking(true);
        setError("");
        setMessage("");
        setResults([]);

        try {
            // Extract spreadsheet ID from URL if needed
            let sheetId = spreadsheetId;
            const urlMatch = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (urlMatch) {
                sheetId = urlMatch[1];
            }

            const response = await fetch("/api/update-pending", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    spreadsheetId: sheetId,
                    googleTokens: JSON.parse(googleTokens),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to check pending presentations");
            }

            setMessage(data.message);
            setResults(data.updates || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-300">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Check Pending Presentations</h3>
            <p className="text-sm text-gray-600 mb-4">
                Manually check and update pending presentations in your tracking sheet
            </p>

            <div className="space-y-4">
                {/* Spreadsheet ID Input */}
                <div>
                    <label className="text-sm font-bold text-gray-800 block mb-2">
                        Tracking Spreadsheet (Link or ID)
                    </label>
                    <input
                        type="text"
                        placeholder="Paste spreadsheet link or ID"
                        value={spreadsheetId}
                        onChange={(e) => setSpreadsheetId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                        disabled={isChecking}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        The Google Sheet created by the automation with pending presentations
                    </p>
                </div>

                {/* Check Button */}
                <button
                    onClick={handleCheckPending}
                    disabled={isChecking || !googleTokens || !spreadsheetId}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-base"
                >
                    {isChecking ? (
                        <>
                            <Loader2 className="animate-spin inline mr-2 h-5 w-5" />
                            Checking Status...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="inline mr-2 h-5 w-5" />
                            Check Pending Status
                        </>
                    )}
                </button>

                {/* Message */}
                {message && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                        <strong>✓</strong> {message}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {/* Results */}
                {results.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-bold text-gray-900 mb-3">Updated Presentations:</h4>
                        <div className="space-y-2">
                            {results.map((result, idx) => (
                                <div key={idx} className="flex items-start justify-between text-sm bg-gray-50 p-3 rounded border border-gray-200">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">{result.name}</p>
                                        <p className="text-xs text-gray-600 mt-1">
                                            Status: {result.status}
                                        </p>
                                    </div>
                                    {result.url !== '-' && (
                                        <a
                                            href={result.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-3 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-xs font-medium whitespace-nowrap"
                                        >
                                            Open
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Help Text */}
                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border border-gray-200">
                    <p className="font-medium mb-1">💡 How to use:</p>
                    <ol className="list-decimal ml-4 space-y-1">
                        <li>Find the tracking spreadsheet in your Google Drive folder</li>
                        <li>Copy the spreadsheet URL or ID</li>
                        <li>Paste it above and click "Check Pending Status"</li>
                        <li>The sheet will be updated with completed presentations</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
