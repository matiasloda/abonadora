/**
 * Gemini & Local Voice Parser para Abonadora Pro
 * Parser inteligente de lenguaje natural adaptado al campo (rioplatense/agro).
 * Extrae: tipo de evento, nombre del campo/fajas, hectáreas, kg restantes, kg recargados, tipo de fertilizante.
 */

class AgroVoiceParser {
  constructor() {
    this.recognition = null;
    this.isRecording = false;
    this.initSpeechRecognition();
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-419'; // Español latinoamericano
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
    }
  }

  isSpeechSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Parser inteligente de texto a datos estructurados
   * @param {string} text Texto dictado por el operador
   * @param {number} currentTolva Stock actual en la tolva
   * @returns {Object} Datos extraídos
   */
  parseInput(text, currentTolva = 0) {
    if (!text || typeof text !== 'string') return null;

    const lower = text.toLowerCase()
      .replace(/[,;]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Normalizar números con coma a punto (ej: "2,5" -> "2.5")
    const normalizedText = text.replace(/(\d+),(\d+)/g, '$1.$2');
    const normLower = normalizedText.toLowerCase();

    const result = {
      rawText: text,
      type: 'field', // 'field', 'refill', 'init'
      fieldName: '',
      hectares: null,
      remainingKg: null,
      refillKg: null,
      fertilizer: '',
      calculatedSpentKg: null,
      calculatedDose: null
    };

    // 1. Detectar si es INICIO DE JORNADA
    if (normLower.includes('arranc') || normLower.includes('inici') || normLower.includes('empez') || normLower.includes('carga inicial')) {
      result.type = 'init';

      // Buscar kilos de carga inicial
      const kgMatch = normLower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos)/);
      if (kgMatch) {
        result.refillKg = parseFloat(kgMatch[1]);
        result.remainingKg = result.refillKg;
      }

      // Buscar tipo de fertilizante (ej: urea, fosfato, superfosfato, mezcla, etc.)
      const fertMatch = normLower.match(/(?:kilos?|kg)\s+de\s+([a-záéíóúñ0-9\s-]+?)(?:\s+de|\s+con|\s*\.|\s*$)/i) ||
                        normLower.match(/(?:con|de)\s+([a-záéíóúñ0-9\s-]+?)(?:\s+de|\s+con|\s*\.|\s*$)/i);
      if (fertMatch) {
        const candidate = fertMatch[1].replace(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos)/g, '').trim();
        if (candidate.length > 2 && !candidate.includes('kilo')) {
          result.fertilizer = this.capitalizeWords(candidate);
        }
      }
      return result;
    }

    // 2. Detectar si es RECARGA DE TOLVA
    const isRefill = normLower.includes('recarg') || 
                     normLower.includes('cargué') || 
                     normLower.includes('cargue') || 
                     normLower.includes('agregu') || 
                     normLower.includes('eche') || 
                     normLower.includes('eché') ||
                     normLower.includes('bolson') ||
                     normLower.includes('bolsón');

    if (isRefill && !normLower.includes('quedan') && !normLower.includes('me queda') && !normLower.includes('restan')) {
      result.type = 'refill';

      // Detectar si habla de bolsones (ej: "2 bolsones de 1000 kilos" o "3 bolsones")
      const bolsonMatch = normLower.match(/(\d+)\s*(?:bolsones|bolson|bolsón|bolsones)\s*(?:de\s*(\d+))?/);
      if (bolsonMatch) {
        const cantBolsones = parseInt(bolsonMatch[1], 10);
        const pesoPorBolson = bolsonMatch[2] ? parseInt(bolsonMatch[2], 10) : 1000; // Por defecto 1000kg (big bag estándar)
        result.refillKg = cantBolsones * pesoPorBolson;
      } else {
        const kgMatch = normLower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos)/);
        if (kgMatch) {
          result.refillKg = parseFloat(kgMatch[1]);
        }
      }
      return result;
    }

    // 3. CAMPO / LOTE COMPLETADO (El caso más frecuente)
    result.type = 'field';

    // A. Extraer Hectáreas (ej: "2.5 ha", "2,5 há", "18 hectáreas", "salieron 25 ha")
    const haMatch = normLower.match(/(\d+(?:\.\d+)?)\s*(?:ha|há|has|hectarea|hectareas|hectárea|hectáreas)/);
    if (haMatch) {
      result.hectares = parseFloat(haMatch[1]);
    }

    // B. Extraer Dosis Objetivo (ej: "a 120 de dosis", "dosis 150", "dosis de 100", "a 100 kg por hectárea")
    const doseMatch = normLower.match(/(?:a|con)\s*(\d+(?:\.\d+)?)\s*(?:de\s*)?dosis/i) || 
                      normLower.match(/(?:dosis|dosis\s*deseada)\s*(?:de)?\s*(\d+(?:\.\d+)?)/i) ||
                      normLower.match(/(\d+(?:\.\d+)?)\s*(?:kg\/ha|kilos\s*por\s*hect[aá]rea)/i);
    if (doseMatch) {
      result.dose = parseFloat(doseMatch[1]);
    }

    // C. Extraer Kg Restantes en Tolva
    // "me quedan 300 kg", "quedaron 500 kilos", "restan 800", "quedan 300"
    const remainingMatch = normLower.match(/(?:quedan|quedaron|me quedan|me quedo|me quedó|restan|restaron|sobran|sobraron|quedo en|quedó en)\s*(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos)?/);
    if (remainingMatch) {
      result.remainingKg = parseFloat(remainingMatch[1]);
    } else {
      // Fallback: si hay otro número con kg al final del texto
      const allKgMatches = [...normLower.matchAll(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos)/g)];
      if (allKgMatches.length > 0) {
        const lastKg = allKgMatches[allKgMatches.length - 1];
        result.remainingKg = parseFloat(lastKg[1]);
      }
    }

    // D. Extraer Nombre de Campo / Lote / Fajas
    // Ejemplo: "terminé campo 31 fajas 10 y 11, salieron 2,5ha me quedan 300kg"
    let cleanForName = normalizedText;
    
    // Quitar prefijos comunes ("terminé", "listo", "hice", "hicimos")
    cleanForName = cleanForName.replace(/^(?:ya\s+)?(?:terminé|termine|terminamos|listo|hice|hicimos|completé|complete)\s+/i, '');

    // Cortar antes de donde se mencionan las ha, la dosis o los kg que quedan
    const splitRegex = /(?:,|;|\s+salieron|\s+hicimos|\s+fueron|\s+hice|\s+con\s+dosis|\s+a\s+dosis|\s+dosis|\s+quedan|\s+quedaron|\s+me quedan|\s+\d+(?:\.\d+)?\s*(?:ha|há|has|hectarea|hectareas))/i;
    const parts = cleanForName.split(splitRegex);

    if (parts.length > 0 && parts[0].trim().length > 0) {
      result.fieldName = this.capitalizeWords(parts[0].trim());
    } else {
      result.fieldName = 'Campo ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Cálculos cruzados de gasto, ha y dosis
    if (result.remainingKg !== null && currentTolva > 0) {
      result.calculatedSpentKg = Math.max(0, currentTolva - result.remainingKg);

      if (result.hectares && result.hectares > 0) {
        result.calculatedDose = Math.round(result.calculatedSpentKg / result.hectares);
      } else if (result.dose && result.dose > 0) {
        // Si dio la dosis en vez de las hectáreas, calcular las hectáreas:
        result.hectares = parseFloat((result.calculatedSpentKg / result.dose).toFixed(2));
        result.calculatedDose = Math.round(result.dose);
      }
    }

    return result;
  }

  capitalizeWords(str) {
    return str.replace(/\b\w/g, l => l.toUpperCase());
  }
}

window.AgroVoiceParser = AgroVoiceParser;
