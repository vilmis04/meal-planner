import type { SourceFile } from "./localeCheck.types";

// Colors come from the Vuetify themes in nuxt.config.ts only (X1d), so both themes always apply: CSS reads them as
// var(--color-*) or rgb(var(--v-theme-*)), Vuetify props by their theme names ("primary", "muted").
export function checkThemeColors(sourceFiles: readonly SourceFile[]): string[] {
  return sourceFiles.flatMap(({ path, text }) => {
    const { styles, code } = splitSource(path, text);
    return [...findStyleColors(styles), ...findCodeColors(code)].map(
      ({ index, source, color }) => `${path}:${getLineNumber(source, index)}: ${color} is not a theme color`,
    );
  });
}

interface ColorMatch {
  index: number;
  // The text the index points into: the whole file, or one <style> block placed at its offset.
  source: string;
  color: string;
}

interface SourceParts {
  styles: string;
  code: string;
}

// Matches "#fff", "#0B6B43" and "#0b6b4380"; not "#__nuxt", "#default" (a slot) or "&#123;".
const HEX_COLOR_REGEX = /(?<![\w&#-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
// Matches "rgb(255 255 255 / 14%)" and "hsl(120, 50%, 50%)"; not "rgb(var(--v-theme-primary))" or "rgba(var(--x), 0.1)".
const COLOR_FUNCTION_REGEX = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*(?!var\()[^)]*\)/gi;
// Matches "color: white" and "border-color: red"; captures the property and the value.
const CSS_DECLARATION_REGEX = /([a-z-]+)\s*:\s*([^;{}]+)/gi;
// Matches color properties such as "color", "background", "border-top-color" and "box-shadow".
const COLOR_PROPERTY_REGEX = /^(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left|block|inline))?(?:-color)?|outline(?:-color)?|fill|stroke|(?:box|text)-shadow|caret-color|accent-color|text-decoration(?:-color)?|--[\w-]+)$/i;
// Matches named CSS colors such as "white" and "grey"; not "white-space", "--color-red" or "transparent".
const CSS_NAMED_COLOR_REGEX = /(?<![\w-])(?:white|black|red|green|blue|yellow|orange|purple|pink|brown|gr[ae]y|silver|navy|teal|maroon|olive|lime|aqua|fuchsia|cyan|magenta)(?![\w-])/gi;
// Matches Vuetify color props with a static value: color="red", bg-color="grey-lighten-2"; captures the value.
const COLOR_PROP_REGEX = /(?<![\w:-])(?:[\w-]*-)?color="([^"]+)"/gi;
// Matches `color: "red"` in script objects; captures the value.
const COLOR_OBJECT_PROPERTY_REGEX = /\bcolor\s*:\s*["']([^"']+)["']/gi;
// Matches Vuetify's material palette names ("red", "blue-grey-darken-2", "white"); not theme names like "primary".
const PALETTE_COLOR_REGEX = /^(?:red|pink|purple|deep-purple|indigo|blue|light-blue|cyan|teal|green|light-green|lime|yellow|amber|orange|deep-orange|brown|blue-grey|grey|black|white|shades-\w+)(?:-(?:lighten|darken|accent)-\d)?$/i;
// Matches a whole <style> block of a single-file component; captures its content.
const STYLE_BLOCK_REGEX = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
// Matches a line break.
const LINE_BREAK_REGEX = /\n/g;
// Matches every character but a line break, to blank text out while keeping its lines.
const NOT_LINE_BREAK_REGEX = /[^\n]/g;

// A .vue file's <style> blocks are CSS and the rest is template and script; each part keeps the file's offsets
// (the other part is blanked out), so line numbers stay right.
const splitSource = (path: string, text: string): SourceParts => {
  if (path.endsWith(".css")) {
    return { styles: text, code: "" };
  }
  if (!path.endsWith(".vue")) {
    return { styles: "", code: text };
  }
  const blank = (part: string): string => part.replace(NOT_LINE_BREAK_REGEX, " ");
  let styles = blank(text);
  let code = text;
  for (const { 0: block, index: start } of text.matchAll(STYLE_BLOCK_REGEX)) {
    const end = start + block.length;
    styles = styles.slice(0, start) + block + styles.slice(end);
    code = code.slice(0, start) + blank(block) + code.slice(end);
  }
  return { styles, code };
};

const findStyleColors = (styles: string): ColorMatch[] => [
  ...findAll(styles, HEX_COLOR_REGEX),
  ...findAll(styles, COLOR_FUNCTION_REGEX),
  ...[...styles.matchAll(CSS_DECLARATION_REGEX)]
    .filter(([, property]) => COLOR_PROPERTY_REGEX.test(property ?? ""))
    .flatMap((declaration) => {
      const [whole, , value = ""] = declaration;
      const valueOffset = declaration.index + whole.length - value.length;
      return findAll(value, CSS_NAMED_COLOR_REGEX).map((match) => ({
        index: valueOffset + match.index,
        source: styles,
        color: match.color,
      }));
    }),
];

const findCodeColors = (code: string): ColorMatch[] => [
  ...findAll(code, HEX_COLOR_REGEX),
  ...findAll(code, COLOR_FUNCTION_REGEX),
  ...[...code.matchAll(COLOR_PROP_REGEX), ...code.matchAll(COLOR_OBJECT_PROPERTY_REGEX)]
    .filter(([, value]) => PALETTE_COLOR_REGEX.test(value ?? ""))
    .map((match) => ({ index: match.index, source: code, color: match[0] })),
];

const findAll = (source: string, regex: RegExp): ColorMatch[] =>
  [...source.matchAll(regex)].map((match) => ({ index: match.index, source, color: match[0] }));

const getLineNumber = (source: string, index: number): number =>
  (source.slice(0, index).match(LINE_BREAK_REGEX)?.length ?? 0) + 1;
