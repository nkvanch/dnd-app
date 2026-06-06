// ============================================================================
// FILE: src/engine/wikiImporter.ts
// D&D Wiki / paste-text import pipeline using the Anthropic API.
//
// Uses claude-sonnet-4-20250514 to parse unstructured D&D content into
// typed content objects that match our Feature/Effect schema.
// ============================================================================
import { Race, CharClass, Spell, Feature } from './types';
import { validateContent, ValidationResult } from './homebrewValidator';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HomebrewContentType = 'race' | 'class' | 'spell' | 'background' | 'feature';

export type HomebrewImportResult = {
  success:  boolean;
  type:     HomebrewContentType | null;
  content:  Race | CharClass | Spell | Feature | null;
  warnings: string[];
  errors:   string[];
};

// ── Direct Anthropic API call (no SDK — avoids Node.js built-in imports) ─────

/**
 * Calls the Anthropic Messages API via plain fetch.
 * Uses EXPO_PUBLIC_ANTHROPIC_API_KEY from the environment.
 * Returns the raw text content of the first text block in the response.
 */
async function callClaude(userPrompt: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
  if (!apiKey || apiKey === 'your_key_here' || apiKey.length < 10) {
    throw new Error('API_KEY_MISSING');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key':         apiKey,
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    content: { type: string; text: string }[];
  };

  const textBlock = data.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text block in Anthropic response');
  return textBlock.text;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are parsing D&D 5th Edition content into structured JSON for a companion app.
Extract the provided content and return ONLY valid JSON — no markdown, no code fences, no explanation.

The JSON must match one of these shapes:

For RACES:
{"type":"race","data":{"id":"<snake_case_id>","name":"<Name>","features":[{"id":"<id>","name":"<name>","description":"<text>","source":{"kind":"race","refId":"<race_id>"},"level":null,"effects":[...],"actions":[],"choices":[],"passive":true}]}}

For CLASSES:
{"type":"class","data":{"id":"<id>","name":"<Name>","hitDie":<4|6|8|10|12>,"features":[]}}

For SPELLS:
{"type":"spell","data":{"id":"<id>","name":"<Name>","level":<0-9>,"school":"<School>","castingTime":"<time>","range":"<range>","components":["V","S","M"],"duration":"<duration>","description":"<text>","upcast":null,"ritual":false,"concentration":false}}

For FEATURES/TRAITS:
{"type":"feature","data":{"id":"<id>","name":"<Name>","description":"<text>","source":{"kind":"feat","refId":"<id>"},"level":null,"effects":[],"actions":[],"choices":[],"passive":true}}

Effects use this structure:
{"type":"stat_modifier","target":"str|dex|con|int|wis|cha|ac|speed|initiative|...","operation":"add|set|multiply","value":<number>,"condition":null}
{"type":"grant_proficiency","target":"skill:<skillName>|armor:<type>|weapon:<type>","operation":"add","value":null,"condition":null}
{"type":"grant_resistance","target":"<damageType>","operation":"resistance","value":null,"condition":null}

Return null if the content cannot be parsed into any of these types.`;

// ── Import from URL ───────────────────────────────────────────────────────────

/**
 * Fetches a URL and passes the extracted text through the import pipeline.
 * Strips HTML tags to get plain text before sending to the LLM.
 */
export async function importFromUrl(url: string): Promise<HomebrewImportResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return failure([`Failed to fetch URL: HTTP ${response.status}`]);
    }
    const html  = await response.text();
    const text  = stripHtml(html);
    return importFromText(text);
  } catch (e) {
    return failure([`Network error: ${String(e)}`]);
  }
}

/**
 * Parses raw text (pasted wiki content, rulebook excerpt, etc.)
 * through Claude and validates the result.
 */
export async function importFromText(text: string): Promise<HomebrewImportResult> {
  if (!text.trim()) {
    return failure(['Input text is empty.']);
  }

  // Truncate to keep within context limits
  const truncated = text.slice(0, 12000);

  try {
    const rawText = await callClaude(truncated);

    if (!rawText.trim() || rawText.trim() === 'null') {
      return failure(['Claude could not parse the provided content into a known D&D structure.']);
    }

    // Strip markdown code fences if present before parsing
    const cleanText = rawText.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/,      '')
      .replace(/\s*```$/,      '')
      .trim();

    // Parse JSON
    let parsed: { type: HomebrewContentType; data: unknown } | null;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      return failure([`Claude returned invalid JSON. Raw response: ${rawText.slice(0, 200)}`]);
    }

    if (!parsed || !parsed.type || !parsed.data) {
      return failure(['Parsed response missing type or data fields.']);
    }

    // Normalize the data before validation
    const normalizedData = normalizeContent(parsed.data);

    // Validate the parsed content
    const validation: ValidationResult = validateContent(parsed.type, normalizedData);

    return {
      success:  validation.valid,
      type:     parsed.type,
      content:  normalizedData as Race | CharClass | Spell | Feature,
      warnings: validation.warnings,
      errors:   validation.errors,
    };

  } catch (e) {
    return failure([`Anthropic API error: ${String(e)}`]);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_SOURCE_KINDS = new Set([
  'race','class','subclass','background','feat','item','spell','condition','campaign',
]);

/**
 * Normalizes a parsed feature object to fill in required fields with safe defaults:
 *  - effects/actions/choices default to []
 *  - passive defaults to true
 *  - level defaults to null
 *  - effect.condition: undefined → null
 *  - source.kind: unknown → 'campaign'
 */
function normalizeFeature(f: Record<string, unknown>): Record<string, unknown> {
  const source = (f.source && typeof f.source === 'object') ? { ...(f.source as Record<string, unknown>) } : { kind: 'campaign', refId: String(f.id ?? '') };
  if (!VALID_SOURCE_KINDS.has(String(source.kind))) {
    source.kind = 'campaign';
  }

  const effects = Array.isArray(f.effects) ? (f.effects as Record<string, unknown>[]).map(e => ({
    ...e,
    condition: e.condition === undefined ? null : e.condition,
  })) : [];

  return {
    ...f,
    source,
    effects,
    actions:  Array.isArray(f.actions) ? f.actions : [],
    choices:  Array.isArray(f.choices) ? f.choices : [],
    passive:  typeof f.passive === 'boolean' ? f.passive : true,
    level:    f.level !== undefined ? f.level : null,
  };
}

/**
 * Normalizes raw parsed content: fills missing Feature fields with safe defaults
 * so validation doesn't fail on optional-but-expected fields.
 */
function normalizeContent(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const d = data as Record<string, unknown>;

  // Normalize features array (present on races, classes, backgrounds)
  if (Array.isArray(d.features)) {
    d.features = d.features.map((f: unknown) =>
      f && typeof f === 'object' ? normalizeFeature(f as Record<string, unknown>) : f
    );
  }

  // Normalize top-level feature object
  if (d.id && d.name && (d.effects !== undefined || d.source !== undefined)) {
    return normalizeFeature(d);
  }

  // Normalize spell booleans / arrays
  if (typeof d.ritual       === 'undefined') d.ritual        = false;
  if (typeof d.concentration === 'undefined') d.concentration = false;
  if (!Array.isArray(d.components))          d.components    = [];
  if (d.upcast === undefined)                d.upcast        = null;

  return d;
}

function failure(errors: string[]): HomebrewImportResult {
  return { success: false, type: null, content: null, warnings: [], errors };
}

/** Crude HTML stripper — removes tags and decodes common entities. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi,  '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
