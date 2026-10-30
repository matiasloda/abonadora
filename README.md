# Abonadora Pro 🚜🌾
### Control de Tolva, Cierre de Lotes y Reportes en PDF / WhatsApp con Dictado por Voz

Aplicación web móvil diseñada para operadores de abonadoras y fertilizadoras agrícolas. Permite llevar el control del saldo de tolva campo por campo, registrar recargas y generar reportes oficiales en PDF y resúmenes directos para WhatsApp.

---

## 🌟 Funcionalidades Principales

1. **Dictado por Voz Inteligente (Manos Libres en Cabina):**
   - Toca el botón de micrófono y di tu reporte con lenguaje natural:
     > *"Terminé campo 31 fajas 10 y 11, salieron 2,5 ha, me quedan 300 kg"*
   - La aplicación extrae de forma instantánea el lote, las hectáreas y la tolva restante.
   - Calcula automáticamente el fertilizante gastado y la dosis real aplicada (`kg/ha`).

2. **Cálculo Encadenado de Tolva:**
   - Cada campo toma como inicio lo que quedó del campo anterior (o la recarga previa).
   - `Kg Gastados = Tolva Inicial - Tolva Restante`.
   - `Dosis = Kg Gastados / Hectáreas`.

3. **Recargas Intermedias:**
   - Botón rápido o dictado por voz para agregar kilos en cualquier momento de la jornada.

4. **Exportación a PDF Oficial:**
   - Genera una hoja membretada con encabezado (Fecha, Fertilizante, Carga Inicial), tabla cronológica con cada campo y recarga, y totales acumulados con espacio de firma.

5. **Compartir en WhatsApp:**
   - Con un solo clic abre WhatsApp con el resumen formateado con emojis, listo para enviar al dueño, agrónomo o contratista.

6. **100% Offline y Privado:**
   - Todos los datos se guardan en el almacenamiento local del teléfono (`localStorage`). No se pierde nada si se apaga la pantalla o no hay señal.

---

## 🚀 Cómo probar y usar la app

### Opción 1: Abrir directamente en el navegador
Abre el archivo `index.html` en tu navegador favorito (Chrome, Edge o Safari).

### Opción 2: Abrir con servidor local (recomendado para probar en el celular)
En una terminal dentro de la carpeta `abonadora-app`:
```bash
python3 -m http.server 8080
```
Luego en tu celular conectado a la misma red WiFi abre `http://<IP-DE-TU-PC>:8080` y toca en el menú del navegador:
**"Agregar a la pantalla principal"** o **"Instalar aplicación"**.
