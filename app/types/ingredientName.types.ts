// A canonical ingredient (G1) as read for its names: the Lithuanian source name and its translations (X1b).
export interface IngredientNameEntry {
  id: string;
  sourceName: string;
  names: { locale: string; name: string }[];
}
