"use client";

import { useState } from "react";
import { StoryViewer } from "@/components/immersive/story-viewer";
import { VoiceChat } from "@/components/immersive/voice-chat";
import { STORIES } from "@/lib/stories-data";

export default function ImmersivePage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  const currentStory = STORIES[currentIndex];

  return (
    <>
      <StoryViewer
        stories={STORIES}
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
