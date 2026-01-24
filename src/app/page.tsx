import { ChatInterface } from "@/components/chat/chat-interface";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-asturias-blue mb-2">
            Descubre Asturias
          </h1>
          <p className="text-muted-foreground text-lg">
            Tu guia personal para explorar el paraiso natural
          </p>
        </header>
        <ChatInterface />
      </div>
    </main>
  );
}
