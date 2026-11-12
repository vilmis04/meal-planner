// LayoutPage's widths (X4): forms and settings, lists to read, two panes, and the plan's full week.
export type PageWidth = "narrow" | "medium" | "wide" | "full";

// Where LayoutSplit's side pane sits, and how wide it is.
export type SplitAside = "start" | "end";
export type SplitAsideWidth = "list" | "picker";

// The breakpoint from which LayoutSplit shows its panes side by side.
export type SplitBreakpoint = "md" | "lg";

// What a phone shows of a LayoutSplit: one pane, or both one above the other.
export type SplitPhonePane = "main" | "aside" | "both";

// LayoutActionBar: buttons floating above the bottom navigation on phones, or a bar stuck to the bottom of a form.
export type ActionBarVariant = "float" | "sticky";
