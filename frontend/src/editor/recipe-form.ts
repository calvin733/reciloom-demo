import type { ExperimentInput, RecipeDetail, RecipeInput } from '../api/recipes';
import type { FieldIssue } from '../api/http';

export type IngredientRow = {
  key: string; name: string; quantity: string; unit: string; note: string;
  changeReason: string; observedEffect: string;
};
export type StepRow = { key: string; instruction: string };
export type RecipeForm = {
  title: string; ingredients: IngredientRow[]; steps: StepRow[];
  experimentGoal: string; experimentResult: string; experimentStatus: ExperimentInput['experimentStatus'];
};
export const newIngredient = (): IngredientRow => ({ key: crypto.randomUUID(), name: '', quantity: '', unit: '', note: '', changeReason: '', observedEffect: '' });
export const newStep = (): StepRow => ({ key: crypto.randomUUID(), instruction: '' });
export const emptyForm = (): RecipeForm => ({ title: '', ingredients: [newIngredient()], steps: [newStep()], experimentGoal: '', experimentResult: '', experimentStatus: 'NOT_TESTED' });

export function fromRecipe(recipe: RecipeDetail): RecipeForm {
  return {
    title: recipe.title,
    ingredients: recipe.ingredients.length ? recipe.ingredients.map(row => ({
      key: row.id, name: row.name, quantity: row.quantity, unit: row.unit,
      note: row.note ?? '', changeReason: row.changeReason ?? '', observedEffect: row.observedEffect ?? '',
    })) : [newIngredient()],
    steps: recipe.steps.length ? recipe.steps.map(row => ({ key: row.id, instruction: row.instruction })) : [newStep()],
    experimentGoal: recipe.experimentGoal ?? '', experimentResult: recipe.experimentResult ?? '', experimentStatus: recipe.experimentStatus,
  };
}
const filledIngredients = (form: RecipeForm) => form.ingredients.filter(row => [row.name, row.quantity, row.unit, row.note, row.changeReason, row.observedEffect].some(value => value.trim()));
const filledSteps = (form: RecipeForm) => form.steps.filter(row => row.instruction.trim());
const nullable = (value: string) => value.trim() || null;
const fieldLabels: Record<string, string> = {
  quantity: 'amount',
  changeReason: 'reason for change',
  observedEffect: 'observed effect',
  instruction: 'instructions',
};

export function formatFieldIssue(form: RecipeForm, { field, message }: FieldIssue) {
  const [section, index, property] = field.split('.');
  if ((section !== 'ingredients' && section !== 'steps') || index === undefined || !/^\d+$/.test(index)) return message;
  const submittedIndex = Number(index);
  const formIndex = section === 'ingredients'
    ? form.ingredients.indexOf(filledIngredients(form)[submittedIndex])
    : form.steps.indexOf(filledSteps(form)[submittedIndex]);
  if (formIndex < 0) return message;
  const row = section === 'ingredients' ? 'Ingredient' : 'Step';
  const label = property ? ` ${fieldLabels[property] ?? property}` : '';
  return `${row} ${formIndex + 1}${label} (${message.replace(/\.$/, '')})`;
}

export function toPayload(form: RecipeForm): RecipeInput {
  return {
    title: form.title.trim(),
    ingredients: filledIngredients(form).map(row => ({
      name: row.name.trim(), quantity: row.quantity.trim(), unit: row.unit.trim(),
      ...(row.note.trim() ? { note: row.note.trim() } : {}),
      changeReason: nullable(row.changeReason), observedEffect: nullable(row.observedEffect),
    })),
    steps: filledSteps(form).map(row => ({ instruction: row.instruction.trim() })),
  };
}
export const toExperiment = (form: RecipeForm): ExperimentInput => ({
  experimentGoal: nullable(form.experimentGoal), experimentResult: nullable(form.experimentResult), experimentStatus: form.experimentStatus,
});

export function draftIssues(form: RecipeForm, isFork: boolean): string[] {
  const issues: string[] = [];
  if (!form.title.trim()) issues.push('Enter a recipe title');
  if (form.title.trim().length > 150) issues.push('Keep the recipe title to 150 characters or fewer');
  if (form.ingredients.length > 50 || form.steps.length > 50) issues.push('Use up to 50 ingredients and 50 steps');
  filledIngredients(form).forEach(row => {
    const number = form.ingredients.indexOf(row) + 1;
    if (!row.name.trim() || row.name.trim().length > 150) issues.push(`Enter a name of up to 150 characters for ingredient ${number}`);
    if (!/^(0|[1-9]\d{0,8})(\.\d{1,3})?$/.test(row.quantity.trim()) || Number(row.quantity) <= 0) issues.push(`Use a positive amount for ingredient ${number}, with up to 9 digits before the decimal point and 3 after it`);
    if (!row.unit.trim() || row.unit.trim().length > 30) issues.push(`Enter a unit of up to 30 characters for ingredient ${number}`);
    if (row.note.trim().length > 500 || row.changeReason.trim().length > 1000 || row.observedEffect.trim().length > 2000) issues.push(`Shorten the notes for ingredient ${number}`);
  });
  if (filledSteps(form).some(row => row.instruction.trim().length > 5000)) issues.push('Keep each step to 5,000 characters or fewer');
  if (isFork) {
    if (form.experimentGoal.trim().length > 1000 || form.experimentResult.trim().length > 3000) issues.push('Use up to 1,000 characters for the goal and 3,000 for the result');
    if (form.experimentStatus !== 'NOT_TESTED' && !form.experimentResult.trim()) issues.push('Add a result when you mark an experiment as tested');
  }
  return issues;
}
export function publishIssues(form: RecipeForm, isFork: boolean): string[] {
  const titleLength = form.title.trim().length;
  return [...draftIssues(form, isFork),
    ...(titleLength > 0 && titleLength < 3 ? ['Use at least 3 characters in the recipe title'] : []),
    ...(filledIngredients(form).length === 0 ? ['Add at least one complete ingredient'] : []),
    ...(filledSteps(form).length === 0 ? ['Add at least one step'] : []),
  ];
}

export function moveRow<T>(rows: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
