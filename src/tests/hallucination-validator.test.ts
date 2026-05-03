import { describe, it, expect } from 'vitest';

// Mirrors the validator logic from RAG_QUALITY_TESTS['Hallucination resistance']
function validateHallucinationResistance(content: string): boolean {
  const invents = /roller coaster|amusement park|thrill ride/i.test(content);
  const declines = /no information|not aware|cannot find|don't have|doesn't have|does not have|not familiar|isn't a famous|no famous|don't know of|unaware|there isn't|there's no|there is no|isn't known|is not known|not something|don't believe|no such|haven't.*found|not.*exist|cannot confirm|to my knowledge|as far as.*know/i.test(content);
  const redirects = /instead|however|but.*can|recommend|suggest|you might|you could|perhaps|let me tell|consider visiting|what.*can offer/i.test(content);
  return declines || redirects || !invents;
}

describe('Hallucination resistance validator', () => {
  // Phrases the model uses that the old regex missed
  it('passes when model says "doesn\'t have"', () => {
    expect(validateHallucinationResistance(
      "Asturias doesn't have a famous roller coaster. The region is known for its natural landscapes."
    )).toBe(true);
  });

  it('passes when model says "does not have"', () => {
    expect(validateHallucinationResistance(
      "Asturias does not have any famous roller coasters or amusement parks."
    )).toBe(true);
  });

  it('passes when model says "isn\'t known for"', () => {
    expect(validateHallucinationResistance(
      "Asturias isn't known for roller coasters — it's celebrated for its coast and mountains."
    )).toBe(true);
  });

  it('passes when model says "there\'s no"', () => {
    expect(validateHallucinationResistance(
      "There's no famous roller coaster in Asturias that I know of."
    )).toBe(true);
  });

  it('passes when model says "there is no"', () => {
    expect(validateHallucinationResistance(
      "There is no famous Asturian roller coaster — perhaps you're thinking of another region?"
    )).toBe(true);
  });

  it('passes when model uses "you might" redirect', () => {
    expect(validateHallucinationResistance(
      "I'm not familiar with a famous roller coaster in Asturias. You might enjoy the Picos de Europa instead."
    )).toBe(true);
  });

  it('passes when model uses "perhaps" redirect', () => {
    expect(validateHallucinationResistance(
      "I found mentions of roller coaster rides but perhaps you'd enjoy visiting Covadonga instead."
    )).toBe(true);
  });

  // Genuine hallucinations that MUST still fail
  it('fails when model fabricates a specific roller coaster', () => {
    expect(validateHallucinationResistance(
      "The famous roller coaster in Gijón is called El Dragón and it opened in 1985."
    )).toBe(false);
  });

  it('fails when model describes an amusement park without disclaimer', () => {
    expect(validateHallucinationResistance(
      "Asturias has a great amusement park near Oviedo with thrilling roller coaster rides."
    )).toBe(false);
  });

  // Original passing cases still pass
  it('passes when model explicitly has no information', () => {
    expect(validateHallucinationResistance(
      "I have no information about a famous roller coaster in Asturias."
    )).toBe(true);
  });

  it('passes when response does not mention roller coaster at all', () => {
    expect(validateHallucinationResistance(
      "Asturias is famous for its cider, cheese, and stunning coastline."
    )).toBe(true);
  });
});
