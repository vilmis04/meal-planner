import { BREAKPOINTS, getMaxWidthQuery, getMinWidthQuery } from "../shared/utils/layoutBreakpoints";
import type { Breakpoint } from "../shared/utils/layoutBreakpoints";
import type { SourceFile } from "./localeCheck.types";

// Every layout change happens at one of the defined breakpoints (X4, shared/utils/layoutBreakpoints.ts): a media
// query's width is `(min-width: 960px)` from a breakpoint up or `(max-width: 959.98px)` below it, and the
// `--breakpoint-*` tokens say the same numbers. Container queries size a component to its own box and are not checked.
export function checkLayoutBreakpoints(sourceFiles: readonly SourceFile[]): string[] {
  return sourceFiles.flatMap(({ path, text: source }) => {
    const text = blankComments(source);
    return [
      ...findMediaWidths(text).map(({ index, feature }) => `${path}:${getLineNumber(text, index)}: ${feature} is not a layout breakpoint`),
      ...findBreakpointTokens(text).map(({ index, token }) => `${path}:${getLineNumber(text, index)}: ${token} does not match shared/utils/layoutBreakpoints.ts`),
    ];
  });
}

interface MediaWidth {
  index: number;
  feature: string;
}

interface BreakpointToken {
  index: number;
  token: string;
}

// Matches a whole "@media … {" prelude; captures the conditions.
const MEDIA_RULE_REGEX = /@media\b([^{]*)\{/g;
// Matches "(min-width: 960px)", "(max-width:959.98px)", "(width >= 960px)" and "(min-width: 60em)".
const WIDTH_FEATURE_REGEX = /\(\s*(?:(?:min|max)-width\s*:|width\s*[<>]=?)[^)]*\)/g;
// Matches every run of white space, to compare "(min-width:960px)" with "(min-width: 960px)".
const WHITE_SPACE_REGEX = /\s+/g;
// Matches "--breakpoint-md: 960px"; captures the name and the value.
const BREAKPOINT_TOKEN_REGEX = /--breakpoint-([\w-]+)\s*:\s*([^;\n]+);/g;
// Matches a CSS or HTML comment, which may mention a query or a token in its prose.
const COMMENT_REGEX = /\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g;
// Matches every character but a line break, to blank text out while keeping its lines.
const NOT_LINE_BREAK_REGEX = /[^\n]/g;
// Matches a line break.
const LINE_BREAK_REGEX = /\n/g;

const blankComments = (text: string): string =>
  text.replace(COMMENT_REGEX, (comment) => comment.replace(NOT_LINE_BREAK_REGEX, " "));

const isBreakpoint = (name: string): name is Breakpoint => Object.hasOwn(BREAKPOINTS, name);

const normalise = (feature: string): string => feature.replace(WHITE_SPACE_REGEX, "").toLowerCase();

const ALLOWED_FEATURES = new Set(
  Object.keys(BREAKPOINTS)
    .filter(isBreakpoint)
    .flatMap((breakpoint) => [getMinWidthQuery(breakpoint), getMaxWidthQuery(breakpoint)])
    .map(normalise),
);

const findMediaWidths = (text: string): MediaWidth[] =>
  [...text.matchAll(MEDIA_RULE_REGEX)].flatMap((rule) =>
    [...(rule[1] ?? "").matchAll(WIDTH_FEATURE_REGEX)]
      .filter(([feature]) => !ALLOWED_FEATURES.has(normalise(feature)))
      .map(([feature]) => ({ index: rule.index, feature })),
  );

const findBreakpointTokens = (text: string): BreakpointToken[] =>
  [...text.matchAll(BREAKPOINT_TOKEN_REGEX)]
    .filter(([, name = "", value = ""]) => !isBreakpoint(name) || value.trim() !== `${BREAKPOINTS[name]}px`)
    .map((match) => ({ index: match.index, token: match[0] }));

const getLineNumber = (source: string, index: number): number =>
  (source.slice(0, index).match(LINE_BREAK_REGEX)?.length ?? 0) + 1;
