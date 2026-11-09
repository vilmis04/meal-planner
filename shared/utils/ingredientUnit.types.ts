// An amount of an ingredient in one unit, as recipes store it ("to taste" items have no amount and are not one).
export interface IngredientQuantity {
  amount: number;
  unit: string;
}

// How many base units one unit is: 1 kg is 1000 g.
export interface UnitConversion {
  unit: string;
  baseUnit: string;
  factor: number;
}
