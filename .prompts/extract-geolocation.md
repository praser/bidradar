You are performing **forensic-grade OCR and image reconstruction** on a low-resolution image.

Your objective is maximum fidelity extraction — not speed.

Focus **ONLY** on the bottom-right corner of the image.

---

## Mandatory Processing Pipeline

### Phase 1 — Region Isolation
1. Isolate the bottom-right quadrant only.
2. Ignore all other areas of the image completely.
3. Treat this region as a standalone cropped image.

---

### Phase 2 — Upscaling & Enhancement (Critical)

Before attempting to read anything:

1. Conceptually upscale the cropped region by **4x–8x resolution**.
2. Perform simulated super-resolution reconstruction.
3. Apply:
   - Edge enhancement
   - Contrast amplification
   - Noise reduction
   - Deblurring
   - Sharpening
4. Increase local contrast around text strokes.
5. Separate foreground (text) from background using threshold logic.
6. Reconstruct broken glyph edges before interpreting characters.

Only after this enhancement phase proceed to OCR.

---

### Phase 3 — Multi-Pass OCR

Perform at least **three independent reading passes**:

Pass A:
- Character-by-character strict transcription.

Pass B:
- Re-evaluate ambiguous glyphs using stroke geometry and spacing.

Pass C:
- Validate consistency of:
  - Digit spacing
  - Symbol repetition
  - Coordinate formatting patterns

Compare all passes before finalizing.

Do NOT guess missing characters.
If a character is unclear, mark it as:

`[?]`

---

## Extraction Rules

You must output the extracted text EXACTLY as it appears, preserving:

- Line breaks
- Spacing
- Symbols
- Degree symbols (°)
- Quotes (")
- Apostrophes (')
- Minus signs (-)
- Decimal points
- Cardinal directions (N, S, E, W)

Do not normalize.
Do not autocorrect.
Do not infer.

---

## Coordinate Extraction

After raw transcription:

1. Extract:
   - Latitude
   - Longitude
2. Preserve original format (DMS if present).
3. If coordinates are in DMS:
   - Convert to Decimal Degrees.
4. If already in Decimal:
   - Validate sign convention (N/S positive/negative, E/W positive/negative).

If any numeric digit is uncertain, propagate uncertainty into decimal conversion and explain impact.

---

## Output Format

RAW TEXT:
<exact transcription>

COORDINATES (Original Format):
Latitude:
Longitude:

COORDINATES (Decimal):
Latitude:
Longitude:

UNCERTAINTIES:
- List each uncertain character
- Specify its position
- Explain why it is ambiguous
- Indicate confidence level (Low / Medium / High)

---

If necessary, simulate additional enhancement passes before committing to the final transcription.

Precision is more important than speed.

Never guess.