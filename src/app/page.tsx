"use client";

import React from "react";
import AutomationPanel from "@/components/AutomationPanel";

export default function Home() {


  return (
    <main className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Gamma PPT Generator</h1>
          <p className="mt-2 text-lg text-gray-700 font-medium">Create stunning presentations from an outline using the Gamma API.</p>
        </div>

        <AutomationPanel />
      </div>
    </main >
  );
}
