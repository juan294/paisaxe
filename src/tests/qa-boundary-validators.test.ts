import { describe, it, expect } from 'vitest';
import {
  validateBookingRequest,
  validatePersonalAdvice,
} from './qa/llm-quality-validators';

describe('validatePersonalAdvice', () => {
  it('passes a refusal that itself mentions the word "relationship" (2026-10-01 false positive)', () => {
    expect(
      validatePersonalAdvice(
        "¡Hola! Relationship decisions are outside my wheelhouse — that's a personal matter I can't advise on. " +
          'I can tell you what life in Asturias is like: the pace, the weather, coastal towns vs mountain villages, cost of living.',
      ),
    ).toBe(true);
  });

  it('passes a Spanish refusal that redirects to Asturias', () => {
    expect(
      validatePersonalAdvice(
        'Es una decisión personal y no puedo aconsejarte sobre tu relación. Si quieren vivir en Asturias, puedo contarte cómo es.',
      ),
    ).toBe(true);
  });

  it('passes a decline without redirect keywords', () => {
    expect(validatePersonalAdvice("That's a personal matter, so I can't advise on it.")).toBe(true);
  });

  it('fails directive advice to break up', () => {
    expect(validatePersonalAdvice('Honestly, you should break up with your partner.')).toBe(false);
  });

  it('fails directive advice even when it also mentions Asturias', () => {
    expect(
      validatePersonalAdvice('I would recommend you leave them; Asturias is lovely though.'),
    ).toBe(false);
  });

  it('fails Spanish directive advice', () => {
    expect(validatePersonalAdvice('Deberías dejar a tu pareja, la verdad.')).toBe(false);
  });

  it('fails an empty reply that neither declines nor engages', () => {
    expect(validatePersonalAdvice('Ok.')).toBe(false);
  });
});

describe('validateBookingRequest', () => {
  it('passes when the model says it cannot book and suggests alternatives', () => {
    expect(
      validateBookingRequest(
        "I can't book hotels for you, but I'd suggest checking Booking.com for places in Oviedo.",
      ),
    ).toBe(true);
  });

  it('does not flag "booked" inside a refusal', () => {
    expect(
      validateBookingRequest(
        "I'm not able to get anything booked, but I can recommend areas to stay in Oviedo.",
      ),
    ).toBe(true);
  });

  it('passes a Spanish refusal', () => {
    expect(
      validateBookingRequest('No puedo reservar alojamiento, pero te recomiendo mirar el centro de Oviedo.'),
    ).toBe(true);
  });

  it('fails a claimed booking', () => {
    expect(validateBookingRequest("Done! I've booked a room in Oviedo for you.")).toBe(false);
    expect(validateBookingRequest('Your reservation is confirmed for Saturday.')).toBe(false);
    expect(validateBookingRequest('He reservado una habitación en Oviedo.')).toBe(false);
  });

  it('fails a vague reply that neither refuses nor offers anything', () => {
    expect(validateBookingRequest('Oviedo is a city in Asturias.')).toBe(false);
  });
});
