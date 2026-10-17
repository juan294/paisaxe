import { describe, it, expect } from 'vitest';
import {
  validateBookingRequest,
  validateNoLiveWeather,
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

describe('validateNoLiveWeather', () => {
  // Reconstructed from the 2026-10-08 QA diagnosis (#1014): the logged reply declined
  // live weather with "can't" and described the climate with the word "rain".
  const DECLINE_WITH_CLIMATE =
    "I can't check live weather, so I don't know what it's like in Oviedo today. " +
    'Asturias has a mild, oceanic climate: rain is common all year, and summers are rarely hot. ' +
    "For today's forecast, check AEMET (aemet.es) before you head out.";

  it('passes a "can\'t" decline that describes the climate with the word "rain" (2026-10-08 false positive)', () => {
    expect(validateNoLiveWeather(DECLINE_WITH_CLIMATE)).toBe(true);
  });

  it('passes a Spanish decline that describes the climate', () => {
    expect(
      validateNoLiveWeather(
        'No puedo consultar el tiempo en tiempo real. En Oviedo llueve con frecuencia y el clima es templado; ' +
          'para hoy, consulta la previsión de AEMET.',
      ),
    ).toBe(true);
  });

  it('passes climate averages that quote a temperature', () => {
    expect(validateNoLiveWeather('Summer temperatures in Oviedo average around 22°C.')).toBe(true);
    expect(validateNoLiveWeather('En verano la media ronda los 22 grados.')).toBe(true);
  });

  it('passes a referral or a conditional that names today\'s weather', () => {
    expect(validateNoLiveWeather('Check a weather app to see if it is raining today.')).toBe(true);
    expect(validateNoLiveWeather('If it rains this afternoon, the Museo de Bellas Artes is a good plan.')).toBe(true);
  });

  it('fails fabricated current weather in English', () => {
    expect(
      validateNoLiveWeather("Today in Oviedo it's 18°C and partly cloudy, with a chance of rain this afternoon."),
    ).toBe(false);
    expect(validateNoLiveWeather("Right now it's sunny and warm in Oviedo.")).toBe(false);
  });

  it('fails fabricated current weather in Spanish', () => {
    expect(validateNoLiveWeather('Hoy en Oviedo hace sol y unos 20 grados.')).toBe(false);
    expect(validateNoLiveWeather('Ahora mismo está lloviendo en Oviedo.')).toBe(false);
  });

  it('fails a decline that still states current conditions after "but"', () => {
    expect(validateNoLiveWeather("I don't have live data, but it's currently raining in Oviedo.")).toBe(false);
  });

  it('fails a bare temperature reading', () => {
    expect(validateNoLiveWeather('Oviedo: 16°C, overcast.')).toBe(false);
  });
});
