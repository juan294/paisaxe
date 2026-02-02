import { describe, it, expect } from "vitest";
import {
  detectPhoneNumbers,
  detectAddresses,
  detectPlaceNames,
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

    it("detects phone numbers in 3-2-2-2 format (XXX XX XX XX)", () => {
      const text = "Turismo Asturias: 985 10 55 00";
      const result = detectPhoneNumbers(text);

      expect(result).toHaveLength(1);
      expect(result[0].number).toBe("+34985105500");
      expect(result[0].display).toBe("985 10 55 00");
    });

    it("detects phone numbers in 3-2-2-2 format with mobile prefix", () => {
      const text = "Contacta al 612 34 56 78 para más información.";
      const result = detectPhoneNumbers(text);

      expect(result).toHaveLength(1);
      expect(result[0].number).toBe("+34612345678");
      expect(result[0].display).toBe("612 34 56 78");
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

    it("deduplicates overlapping street and postal code patterns", () => {
      // This text could match both "Calle Uría, 58, Oviedo" and "33003 Oviedo"
      const text = "Visita Calle Uría, 58, 33003 Oviedo para más información.";
      const result = detectAddresses(text);

      // Should only return ONE address, not two
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

  describe("detectPlaceNames", () => {
    it("detects Lagos de Covadonga", () => {
      const text = "Puedes visitar los Lagos de Covadonga, son espectaculares.";
      const result = detectPlaceNames(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Lagos de Covadonga");
      expect(result[0].mapsUrl).toContain("google.com/maps");
    });

    it("detects Basilica de Covadonga", () => {
      const text = "La Basílica de Covadonga es un lugar de peregrinación.";
      const result = detectPlaceNames(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Basílica de Covadonga");
    });

    it("detects Picos de Europa", () => {
      const text = "Los Picos de Europa ofrecen rutas de senderismo increíbles.";
      const result = detectPlaceNames(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Picos de Europa");
    });

    it("detects Ruta del Cares", () => {
      const text = "Te recomiendo hacer la Ruta del Cares, es impresionante.";
      const result = detectPlaceNames(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Ruta del Cares");
    });

    it("detects Playa de Gulpiyuri", () => {
      const text = "La Playa de Gulpiyuri es una playa interior única.";
      const result = detectPlaceNames(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Playa de Gulpiyuri");
    });

    it("detects Catedral de Oviedo", () => {
      const text = "La Catedral de Oviedo es impresionante.";
      const result = detectPlaceNames(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Catedral de Oviedo");
    });

    it("detects Santa María del Naranco", () => {
      const text = "Santa María del Naranco es arte prerrománico asturiano.";
      const result = detectPlaceNames(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Santa María del Naranco");
    });

    it("detects multiple landmarks in one text", () => {
      const text = "Desde Cangas de Onís puedes ir a los Lagos de Covadonga y luego hacer la Ruta del Cares.";
      const result = detectPlaceNames(text);

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.text)).toContain("Cangas de Onís");
      expect(result.map((r) => r.text)).toContain("Lagos de Covadonga");
      expect(result.map((r) => r.text)).toContain("Ruta del Cares");
    });

    it("detects landmarks case-insensitively", () => {
      const text = "Los lagos de covadonga son preciosos.";
      const result = detectPlaceNames(text);

      expect(result).toHaveLength(1);
      expect(result[0].text.toLowerCase()).toBe("lagos de covadonga");
    });

    it("returns empty array when no landmarks found", () => {
      const text = "Asturias tiene una gastronomía excepcional.";
      const result = detectPlaceNames(text);

      expect(result).toEqual([]);
    });

    it("deduplicates repeated landmarks", () => {
      const text = "Los Lagos de Covadonga son bonitos. Los Lagos de Covadonga están en Picos.";
      const result = detectPlaceNames(text);

      expect(result).toHaveLength(1);
    });

    it("detects Bufones de Pría", () => {
      const text = "Los Bufones de Pría lanzan agua cuando hay marejada.";
      const result = detectPlaceNames(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Bufones de Pría");
    });

    it("detects Playa de Rodiles", () => {
      const text = "La Playa de Rodiles es perfecta para surfear.";
      const result = detectPlaceNames(text);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Playa de Rodiles");
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

    it("detects landmarks in addition to addresses", () => {
      const text = "Te recomiendo visitar los Lagos de Covadonga. Quedan cerca de Cangas de Onís.";
      const result = detectChatActions(text);

      expect(result.addresses).toHaveLength(2);
      expect(result.addresses.map((a) => a.text)).toContain("Lagos de Covadonga");
      expect(result.addresses.map((a) => a.text)).toContain("Cangas de Onís");
      expect(result.hasActions).toBe(true);
    });

    it("merges landmarks with street addresses without duplicates", () => {
      const text = "La Catedral de Oviedo está en Plaza Alfonso II, Oviedo.";
      const result = detectChatActions(text);

      // Should have both the landmark and the address
      expect(result.addresses.length).toBeGreaterThanOrEqual(1);
      expect(result.hasActions).toBe(true);
    });
  });
});
