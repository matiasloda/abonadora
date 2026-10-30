/**
 * Gemini & Local Voice Parser para Abonadora Pro
 * Parser inteligente de lenguaje natural adaptado al campo (rioplatense/agro).
 * Extrae: tipo de evento, nombre del campo/fajas, hectáreas, kg restantes, kg recargados, tipo de fertilizante.
 * Soporta conversión automática de números hablados en palabras ("trescientos", "dos coma cinco", "dos mil", etc.)
 */

class AgroVoiceParser {
  constructor() {
    this.currentRecognition = null;
  }

  isSpeechSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Crea una instancia nueva y limpia de SpeechRecognition para cada intento.
   * Esto previene el error "aborted" o "already started" de Chrome y Safari.
   */
  createRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    try {
      const rec = new SpeechRecognition();
      // Idioma compatible
      const navLang = (navigator.language || 'es-ES').toLowerCase();
      rec.lang = navLang.startsWith('es') ? navLang : 'es-ES';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      return rec;
    } catch (e) {
      console.warn('Error instanciando SpeechRecognition:', e);
      return null;
    }
  }

  /**
   * Normaliza números escritos en palabras a dígitos numéricos
   * Ej: "trescientos" -> "300", "dos coma cinco" -> "2.5", "dos mil quinientos" -> "2500"
   */
  normalizeWordsToNumbers(text) {
    if (!text || typeof text !== 'string') return '';
    let str = ' ' + text.toLowerCase().replace(/[,;]/g, ' ').replace(/\s+/g, ' ') + ' ';

    // 1. Decimales hablados: "dos coma cinco", "dos con cinco", "dos punto cinco"
    str = str.replace(/(\d+)\s*(?:coma|con|punto)\s*(\d+)/gi, '$1.$2');
    str = str.replace(/\b(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:coma|con|punto)\s+(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+)\b/gi, (m, a, b) => {
      const map = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
      const numA = map[a] !== undefined ? map[a] : a;
      const numB = map[b] !== undefined ? map[b] : b;
      return ' ' + numA + '.' + numB + ' ';
    });

    // 2. Fracciones coloquiales
    str = str.replace(/\b(\d+)\s+y\s+media\b/gi, (m, n) => ' ' + (parseFloat(n) + 0.5) + ' ');
    str = str.replace(/\b(un|uno|una)\s+y\s+media\b/gi, ' 1.5 ');
    str = str.replace(/\bdos\s+y\s+media\b/gi, ' 2.5 ');
    str = str.replace(/\btres\s+y\s+media\b/gi, ' 3.5 ');
    str = str.replace(/\bcuatro\s+y\s+media\b/gi, ' 4.5 ');
    str = str.replace(/\bmedia\s+hect[aá]rea\b/gi, ' 0.5 hectareas ');

    const words = {
      'cero': 0, 'un': 1, 'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4,
      'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
      'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
      'dieciseis': 16, 'dieciséis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19,
      'veinte': 20, 'veintiuno': 21, 'veintidos': 22, 'veintidós': 22, 'veintitres': 23, 'veintitrés': 23,
      'veinticuatro': 24, 'veinticinco': 25, 'veintiseis': 26, 'veintiséis': 26, 'veintisiete': 27,
      'veintiocho': 28, 'veintinueve': 29, 'treinta': 30, 'cuarenta': 40, 'cincuenta': 50,
      'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90,
      'cien': 100, 'ciento': 100, 'doscientos': 200, 'doscientas': 200,
      'trescientos': 300, 'trescientas': 300, 'cuatrocientos': 400, 'cuatrocientas': 400,
      'quinientos': 500, 'quinientas': 500, 'seiscientos': 600, 'seiscientas': 600,
      'setecientos': 700, 'setecientas': 700, 'ochocientos': 800, 'ochocientas': 800,
      'novecientos': 900, 'novecientas': 900
    };

    // 3. Combinaciones con 'mil': 'tres mil quinientos', 'dos mil', 'mil doscientos'
    str = str.replace(/\b(un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|\d+)?\s*mil\s*(doscientos|doscientas|trescientos|trescientas|cuatrocientos|cuatrocientas|quinientos|quinientas|seiscientos|seiscientas|setecientos|setecientas|ochocientos|ochocientas|novecientos|novecientas|ciento|cien|\d+)?(?:\s+(diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintidos|veintitres|veinticuatro|veinticinco|veintiseis|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|\d+))?\b/gi, (match, m1, h1, d1) => {
      let mult = 1;
      if (m1) mult = words[m1.toLowerCase()] || parseFloat(m1) || 1;
      let add = 0;
      if (h1) add = words[h1.toLowerCase()] || parseFloat(h1) || 0;
      if (d1) add += words[d1.toLowerCase()] || parseFloat(d1) || 0;
      return ' ' + (mult * 1000 + add) + ' ';
    });

    // 4. Centenas + decenas (ej: 'ciento veinte', 'trescientos cincuenta')
    str = str.replace(/\b(ciento|doscientos|doscientas|trescientos|trescientas|cuatrocientos|cuatrocientas|quinientos|quinientas|seiscientos|seiscientas|setecientos|setecientas|ochocientos|ochocientas|novecientos|novecientas)\s+(diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|veintiuno|veintidos|veintitres|veinticuatro|veinticinco|veintiseis|veintisiete|veintiocho|veintinueve|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\b/gi, (m, c, d) => {
      return ' ' + (words[c.toLowerCase()] + words[d.toLowerCase()]) + ' ';
    });

    // 5. Decenas + y + unidades (ej: 'treinta y cinco', 'cuarenta y dos')
    str = str.replace(/\b(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b/gi, (m, d, u) => {
      return ' ' + (words[d.toLowerCase()] + words[u.toLowerCase()]) + ' ';
    });

    // 6. Palabras de números solas (reemplazar primero las centenas, luego decenas y unidades)
    for (const [w, v] of Object.entries(words)) {
      const reg = new RegExp('\\b' + w + '\\b', 'gi');
      str = str.replace(reg, ' ' + v + ' ');
    }

    return str.replace(/\s+/g, ' ').trim();
  }

  /**
   * Parser inteligente de texto a datos estructurados
   * @param {string} rawText Texto dictado o escrito por el operador
   * @param {number} currentTolva Stock actual en la tolva
   * @returns {Object} Datos extraídos
   */
  parseInput(rawText, currentTolva = 0) {
    if (!rawText || typeof rawText !== 'string') return null;

    // Normalizar números escritos en palabras a números arábigos
    const normalizedText = this.normalizeWordsToNumbers(rawText);
    const normLower = normalizedText.toLowerCase();

    const result = {
      rawText: rawText,
      normalizedText: normalizedText,
      type: 'field', // 'field', 'refill', 'init'
      fieldName: '',
      hectares: null,
      remainingKg: null,
      refillKg: null,
      fertilizer: '',
      dose: null,
      calculatedSpentKg: null,
      calculatedDose: null
    };

    // 1. Detectar si es INICIO DE JORNADA
    if (normLower.includes('arranc') || normLower.includes('inici') || normLower.includes('empez') || normLower.includes('carga inicial')) {
      result.type = 'init';

      // Buscar kilos de carga inicial
      const kgMatch = normLower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos)?/);
      if (kgMatch) {
        result.refillKg = parseFloat(kgMatch[1]);
        result.remainingKg = result.refillKg;
      }

      // Buscar tipo de fertilizante (ej: urea, fosfato, superfosfato, mezcla, etc.)
      const fertMatch = normLower.match(/(?:kilos?|kg)?\s*de\s+([a-záéíóúñ0-9\s-]+?)(?:\s+de|\s+con|\s*\.|\s*$)/i) ||
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

    if (isRefill && !normLower.includes('quedan') && !normLower.includes('me queda') && !normLower.includes('restan') && !normLower.includes('sobran')) {
      result.type = 'refill';

      // Detectar si habla de bolsones (ej: "2 bolsones de 1000 kilos" o "3 bolsones")
      const bolsonMatch = normLower.match(/(\d+)\s*(?:bolsones|bolson|bolsón|bolsones)\s*(?:de\s*(\d+))?/);
      if (bolsonMatch) {
        const cantBolsones = parseInt(bolsonMatch[1], 10);
        const pesoPorBolson = bolsonMatch[2] ? parseInt(bolsonMatch[2], 10) : 1000;
        result.refillKg = cantBolsones * pesoPorBolson;
      } else {
        const kgMatch = normLower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos)?/);
        if (kgMatch) {
          result.refillKg = parseFloat(kgMatch[1]);
        }
      }
      return result;
    }

    // 3. CAMPO / LOTE COMPLETADO (El caso principal)
    result.type = 'field';

    // A. Extraer Hectáreas (ej: "2.5 ha", "2.5 há", "18 hectáreas", "salieron 25 ha", "fueron 15 ha")
    const haMatch = normLower.match(/(\d+(?:\.\d+)?)\s*(?:ha|há|has|hectarea|hectareas|hectárea|hectáreas)/i);
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
    // "me quedan 300 kg", "quedaron 500 kilos", "restan 800", "sobran 300", "quedan 300"
    const remainingMatch = normLower.match(/(?:quedan|quedaron|me quedan|me quedo|me quedó|restan|restaron|sobran|sobraron|quedo en|quedó en)\s*(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos)?/i);
    if (remainingMatch) {
      result.remainingKg = parseFloat(remainingMatch[1]);
    } else {
      // Fallback: si hay otro número con kg al final del texto
      const allKgMatches = [...normLower.matchAll(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kilos)/gi)];
      if (allKgMatches.length > 0) {
        const lastKg = allKgMatches[allKgMatches.length - 1];
        result.remainingKg = parseFloat(lastKg[1]);
      }
    }

    // D. Extraer Nombre de Campo / Lote / Fajas
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
