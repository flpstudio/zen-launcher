---
name: check-translations
description: Audit and fix i18n translations in the Zen Launcher extension. Use when the user says "check translations", "fix translations", "translate", "i18n", "missing translations", or after adding new features that introduced new t() keys.
---

# Check & Fix Translations

Audits the `TRANSLATIONS` object in `js/i18n.js` for missing keys across all languages and adds any missing translations.

## Structure

All translations live in a single `TRANSLATIONS` object in `js/i18n.js`:

- **Reference language**: `en` (starts around line 4) — the source of truth for all keys
- **Supported languages**: en, ja, es, fr, de, it, pt, ru, ko, zh
- **Translation function**: `t(key)` falls back to `en` if a key is missing
- **Translation usage**: `t()` calls appear across all `js/*.js` files, and `data-i18n` attributes are used in `newtab.html`

## Workflow

1. **Extract all keys from `en`**
   - Read the `en` block in `TRANSLATIONS` in `js/i18n.js`
   - Collect every key (skip array values like `months`, `shortMonths`)

2. **Compare each language against `en`**
   - For each non-en language block, check which keys from `en` are missing
   - Report the missing keys per language

3. **Add missing translations**
   - For each missing key, provide a proper translation in the target language
   - Insert the key in the same relative position as in `en` (or at the end of the relevant section)
   - Use natural, native translations — not literal word-for-word

4. **Check for orphaned keys**
   - Look for keys in non-en languages that don't exist in `en` (stale/removed keys)
   - Remove them if found

5. **Check for unused keys and delete them**
   - Search all `js/*.js` files for `t('...')` and `t("...")` calls
   - Search `newtab.html` for `data-i18n="..."` attributes
   - Collect every key that is actually referenced in code
   - Compare against the `en` keys — any key in `en` that is NOT referenced anywhere in code is unused
   - Delete unused keys from `en` **and** from every other language block
   - Report which keys were removed

## Language blocks (approximate line ranges in js/i18n.js)

| Language   | Code | Start line |
|------------|------|------------|
| English    | en   | 4          |
| Japanese   | ja   | 296        |
| Spanish    | es   | 584        |
| French     | fr   | 689        |
| German     | de   | 794        |
| Italian    | it   | 899        |
| Portuguese | pt   | 1004       |
| Russian    | ru   | 1109       |
| Korean     | ko   | 1214       |
| Chinese    | zh   | 1319       |

Note: Line numbers shift as keys are added. Use the language code markers (e.g., `ja: {`) to find each block.

## Important Notes

- All translation code is in `js/i18n.js` (not `newtab.js` — the codebase was split into modules under `js/`)
- Always use `en` as the reference — it has all the keys
- Non-en languages use a more compact format (multiple keys per line)
- Match the existing formatting style of each language block
- Do NOT use machine-transliteration; provide natural translations
- After fixing, do a quick sanity check that no syntax errors were introduced (matching braces, commas)
- Also check `data-i18n` attributes in `newtab.html` to ensure they reference valid keys
