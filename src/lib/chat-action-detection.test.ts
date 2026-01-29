import { describe, it, expect } from "vitest";
import {
  detectPhoneNumbers,
  detectAddresses,
  detectChatActions,
} from "./chat-action-detection";

describe("chat-action-detection", () => {
  describe("detectPhoneNumbers", () => {
    it("detects Spanish phone numbers with +34 prefix", () => {
      const text = "Puedes llamar al +34 985 123 456 para reservar.";
      const result = detectPhoneNumbers(text);

      expect(result).toHaveLength(1);
      expect(result[0].number).toBe("+34985123456");
      expect(result[0].display).toBe("+34 985 123 456");
    });

    it("detects Spanish phone numbers with +34 and no spaces", () => {
      const text = "Teléfono: +34985123456";
      const result = detectPhoneNumbers(text);

      expect(result).toHaveLength(1);
      expect(result[0].number).toBe("+34985123456");
      expect(result[0].display).toBe("+34985123456");
    });

    it("detects local Spanish landline numbers (9XX XXX XXX)", () => {
      const text = "El restaurante tiene el teléfono 985 123 456.";
      const result = detectPhoneNumbers(text);

      expect(result).toHaveLength(1);
      expect(result[0].number).toBe("+34985123456");
      expect(result[0].display).toBe("985 123 456");
    });

    it("detects mobile numbers starting with 6 or 7", () => {
      const text = "Contacta al 612 345 678 o al 722 987 654.";
      const result = detectPhoneNumbers(text);

      expect(result).toHaveLength(2);
      expect(result[0].number).toBe("+34612345678");
      expect(result[1].number).toBe("+34722987654");
    });

    it("detects phone numbers without spaces", () => {
      const text = "Llama al 985123456.";
      const result = detectPhoneNumbers(text);

      expect(result).toHaveLength(1);
      expect(result[0].number).toBe("+34985123456");
    });

    it("returns empty array when no phone numbers found", () => {
      const text = "Este restaurante ofrece cocina tradicional asturiana.";
      const result = detectPhoneNumbers(text);

      expect(result).toEqual([]);
    });

    it("ignores numbers that are too short", () => {
      const text = "Hay 123 plazas disponibles en el aparcamiento.";
      const result = detectPhoneNumbers(text);

      expect(result).toEqual([]);
    });

    it("ignores numbers that are part of larger text (postal codes, etc.)", () => {
      const text = "Situado en el 33001 Oviedo, Asturias.";
      const result = detectPhoneNumbers(text);

      expect(result).toEqual([]);
    });

    it("deduplicates repeated phone numbers", () => {
      const text = "Llama al 985 123 456. Recuerda: 985 123 456.";
      const result = detectPhoneNumbers(text);

      expect(result).toHaveLength(1);
    });
  });

  describe("detectAddresses", () => {
    it("detects addresses starting with Calle", () => {
      const text = "Se encuentra en Calle San Francisco, 12, Oviedo.";
      const result = detectAddresses(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toContain("Calle San Francisco");
      expect(result[0].mapsUrl).toContain("google.com/maps");
    });

    it("detects addresses with C. abbreviation", () => {
      const text = "Dirección: C. Uría, 58, Oviedo.";
      const result = detectAddresses(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toContain("C. Uría");
    });

    it("detects addresses starting with Avenida", () => {
      const text = "Ubicado en Avenida de Galicia, 25, Gijón.";
      const result = detectAddresses(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toContain("Avenida de Galicia");
    });

    it("detects addresses with Av. abbreviation", () => {
      const text = "Av. de la Constitución, 10, Avilés.";
      const result = detectAddresses(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toContain("Av. de la Constitución");
    });

    it("detects addresses starting with Plaza", () => {
      const text = "En la Plaza del Ayuntamiento, 1, Oviedo.";
      const result = detectAddresses(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toContain("Plaza del Ayuntamiento");
    });

    it("detects addresses with Pl. abbreviation", () => {
      const text = "Pl. Mayor, 5, Gijón.";
      const result = detectAddresses(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toContain("Pl. Mayor");
    });

    it("detects addresses with postal codes", () => {
      const text = "33001 Oviedo, Asturias es una zona céntrica.";
      const result = detectAddresses(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toContain("33001");
      expect(result[0].text).toContain("Oviedo");
    });

    it("generates correct Google Maps URL", () => {
      const text = "Calle San Francisco, 12, Oviedo.";
      const result = detectAddresses(text);

      expect(result).toHaveLength(1);
      // encodeURIComponent uses %20 for spaces (both %20 and + are valid)
      expect(result[0].mapsUrl).toBe(
        "https://www.google.com/maps/search/?api=1&query=Calle%20San%20Francisco%2C%2012%2C%20Oviedo"
      );
    });

    it("returns empty array when no addresses found", () => {
      const text = "Este lugar tiene vistas espectaculares al mar.";
      const result = detectAddresses(text);

      expect(result).toEqual([]);
    });

    it("deduplicates similar addresses", () => {
      const text = "En Calle Uría, 58. Recuerda: Calle Uría, 58.";
      const result = detectAddresses(text);

      expect(result).toHaveLength(1);
    });

    it("detects addresses with Paseo", () => {
      const text = "En el Paseo del Muelle, junto al puerto.";
      const result = detectAddresses(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toContain("Paseo del Muelle");
    });

    it("detects addresses with Carretera", () => {
      const text = "Carretera de la Costa, km 5, Llanes.";
      const result = detectAddresses(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toContain("Carretera de la Costa");
    });
  });

  describe("detectChatActions", () => {
    it("returns phones and addresses when both present", () => {
      const text =
        "Casa Gerardo está en Calle Prendes, 1, Prendes. Teléfono: +34 985 887 797.";
      const result = detectChatActions(text);

      expect(result.phones).toHaveLength(1);
      expect(result.addresses).toHaveLength(1);
      expect(result.hasActions).toBe(true);
    });

    it("returns only phones when no addresses present", () => {
      const text = "Reserva llamando al 985 123 456.";
      const result = detectChatActions(text);

      expect(result.phones).toHaveLength(1);
      expect(result.addresses).toHaveLength(0);
      expect(result.hasActions).toBe(true);
    });

    it("returns only addresses when no phones present", () => {
      const text = "Visita la Catedral en Plaza Alfonso II, Oviedo.";
      const result = detectChatActions(text);

      expect(result.phones).toHaveLength(0);
      expect(result.addresses).toHaveLength(1);
      expect(result.hasActions).toBe(true);
    });

    it("returns hasActions false when nothing detected", () => {
      const text = "Asturias es conocida como el Paraíso Natural.";
      const result = detectChatActions(text);

      expect(result.phones).toHaveLength(0);
      expect(result.addresses).toHaveLength(0);
      expect(result.hasActions).toBe(false);
    });

    it("handles empty string", () => {
      const result = detectChatActions("");

      expect(result.phones).toHaveLength(0);
      expect(result.addresses).toHaveLength(0);
      expect(result.hasActions).toBe(false);
    });

    it("handles multiple phones and addresses", () => {
      const text = `
        Casa Gerardo: Calle Prendes, 1, Prendes. Tel: 985 887 797.
        Real Balneario: Calle Emilio Laria, 2, Salinas. Tel: 985 518 613.
      `;
      const result = detectChatActions(text);

      expect(result.phones).toHaveLength(2);
      expect(result.addresses).toHaveLength(2);
      expect(result.hasActions).toBe(true);
    });
  });
});
