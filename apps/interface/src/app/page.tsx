"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { PledgeModal } from "@/components/ui/PledgeModal";

const mockCampaigns = [
  {
    id: "1",
    title: "Eco-Friendly Water Purification",
    description: "A compact, solar-powered water purification system for off-grid communities.",
    raised: 15400,
    goal: 20000,
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "2",
    title: "Open Source AI Education Platform",
    description: "Democratizing AI education with free, high-quality interactive courses for everyone.",
    raised: 8200,
    goal: 50000,
    deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    image: "https://images.unsplash.com/photo-1555949963-aa79dcee5789?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "3",
    title: "Community Solar Microgrid",
    description: "Empowering neighborhoods to generate and share sustainable solar energy.",
    raised: 45000,
    goal: 45000,
    deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=800",
  },
];

export default function Home() {
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold mb-4">Fund the Future on Stellar</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Discover and support innovative projects with lightning-fast, secure transactions on the
          Stellar network.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20 grid grid-cols-1 md:grid-cols-3 gap-6">
        {mockCampaigns.map((campaign) => {
          const progress = (campaign.raised / campaign.goal) * 100;
          const isFunded = progress >= 100;
          return (
            <div key={campaign.id} className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={campaign.image} alt={campaign.title} className="w-full h-48 object-cover" />
              <div className="p-5 space-y-3">
                <h2 className="text-lg font-semibold">{campaign.title}</h2>
                <p className="text-gray-400 text-sm">{campaign.description}</p>
                <ProgressBar progress={progress} />
                <div className="flex justify-between text-sm text-gray-400">
                  <span>{campaign.raised.toLocaleString()} XLM raised</span>
                  <span>{campaign.goal.toLocaleString()} XLM goal</span>
                </div>
                <CountdownTimer deadline={campaign.deadline} />
                <button
                  className="w-full py-2 rounded-xl font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  onClick={() => !isFunded && setSelectedCampaign(campaign.title)}
                  disabled={isFunded}
                >
                  {isFunded ? "Successfully Funded" : "Pledge Now"}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {selectedCampaign && (
        <PledgeModal campaignTitle={selectedCampaign} onClose={() => setSelectedCampaign(null)} />
      )}
    </main>
  );
}
