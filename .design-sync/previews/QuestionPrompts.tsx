import { QuestionPrompts } from "paisaxe";

export const Default = () => (
  <div className="p-6">
    <div style={{ width: 460 }}>
      <QuestionPrompts
        storyId="mirador-del-fitu"
        onSelectPrompt={() => {}}
        prompts={[
          "¿Cuál es la mejor hora para ir?",
          "¿Se puede llegar en transporte público?",
          "¿Qué hay cerca para comer?",
        ]}
      />
    </div>
  </div>
);
