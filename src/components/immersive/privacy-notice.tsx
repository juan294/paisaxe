"use client";

import { Button } from "@/components/ui/button";

interface PrivacyNoticeProps {
  onDismiss: () => void;
}

export function PrivacyNotice({ onDismiss }: PrivacyNoticeProps) {
  return (
    <div className="mx-4 mt-2 mb-1 p-3 rounded-xl bg-white/10 border border-white/15 text-white/80 text-xs leading-relaxed">
      <p>
        Tus preguntas se procesan con inteligencia artificial para darte la
        mejor respuesta sobre Asturias. No guardamos tus conversaciones.
      </p>
      <div className="mt-2 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="text-white/70 hover:text-white hover:bg-white/10 text-xs h-7 px-3"
        >
          Entendido
        </Button>
      </div>
    </div>
  );
}
