"use client";

import { useState, useEffect } from "react";
import { StoryViewer } from "@/components/immersive/story-viewer";
import { VoiceChat } from "@/components/immersive/voice-chat";
import { FALLBACK_STORIES, getStoriesFromDB } from "@/lib/stories-data";
import type { Story } from "@/types/immersive";

export default function ImmersivePage() {
  const [stories, setStories] = useState<Story[]>(FALLBACK_STORIES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStories() {
      try {
        const dbStories = await getStoriesFromDB();
        setStories(dbStories);
      } catch (error) {
        console.warn("Failed to load stories from DB, using fallback:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadStories();
  }, []);

  const currentStory = stories[currentIndex];

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="text-white text-lg">Loading stories...</div>
      </div>
    );
  }

  return (
    <>
      <StoryViewer
        stories={stories}
        currentIndex={currentIndex}
        onIndexChange={setCurrentIndex}
        onAskAbout={() => setChatOpen(true)}
      />
      <VoiceChat
        story={currentStory}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </>
  );
}
