export interface SourceFile {
  path: string;
  text: string;
}

export interface LocaleCheckInput {
  // Each locale file as parsed JSON, by locale code ("en", "lt").
  locales: Readonly<Record<string, unknown>>;
  sourceFiles: readonly SourceFile[];
}

// How many forms a plural message may have in a language, and which count has a zero form first.
export interface PluralFormRule {
  formCounts: readonly number[];
  zeroFormCount: number;
  // Lithuanian's "one" form is also 21, 31, 101: it must show the number, not say "one" or "someone".
  isOneFormForSeveralNumbers: boolean;
}

export interface ParsedMessage {
  formCount: number;
  // Placeholders of each form, such as "count" and "name".
  formPlaceholders: ReadonlyArray<ReadonlySet<string>>;
  syntaxErrors: readonly string[];
}
