import { apiRequest } from './http';
export { ApiError } from './http';
import { ApiError } from './http';

export interface RecipeSummary {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED';
  authorId: string | null;
  createdAt: string;
  parentRecipeId: string | null;
  author: { id: string; displayName: string } | null;
  experimentGoal: string | null;
  experimentResult: string | null;
  experimentStatus: 'NOT_TESTED' | 'SUCCESS' | 'FAILED';
}

export interface Ingredient {
  id: string;
  position: number;
  name: string;
  quantity: string;
  unit: string;
  note: string | null;
  changeReason: string | null;
  observedEffect: string | null;
}

export interface RecipeDetail extends RecipeSummary {
  ingredients: Ingredient[];
  steps: { id: string; position: number; instruction: string }[];
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalidResponse = () => new ApiError('ReciLoom received an unexpected recipe response.', 502);

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidResponse();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string') throw invalidResponse();
  return value;
}

function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function position(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) throw invalidResponse();
  return value;
}

function summary(value: unknown, privateRecipe = false): RecipeSummary {
  const data = object(value);
  const author = data.author === null ? null : object(data.author);
  if (!(data.status === 'PUBLISHED' || (privateRecipe && data.status === 'DRAFT')) || !['NOT_TESTED', 'SUCCESS', 'FAILED'].includes(text(data.experimentStatus))) {
    throw invalidResponse();
  }
  const id = text(data.id);
  const createdAt = text(data.createdAt);
  if (!uuid.test(id) || Number.isNaN(Date.parse(createdAt))) throw invalidResponse();
  return {
    id,
    title: text(data.title),
    status: data.status as RecipeSummary['status'],
    authorId: data.authorId === undefined ? (author === null ? null : text(author.id)) : nullableText(data.authorId),
    createdAt,
    parentRecipeId: nullableText(data.parentRecipeId),
    author: author === null ? null : { id: text(author.id), displayName: text(author.displayName) },
    experimentGoal: nullableText(data.experimentGoal),
    experimentResult: nullableText(data.experimentResult),
    experimentStatus: data.experimentStatus as RecipeSummary['experimentStatus'],
  };
}

function detail(value: unknown, privateRecipe = false): RecipeDetail {
  const data = object(value);
  if (!Array.isArray(data.ingredients) || !Array.isArray(data.steps)) throw invalidResponse();
  return {
    ...summary(data, privateRecipe),
    ingredients: data.ingredients.map((value) => {
      const ingredient = object(value);
      const quantity = text(ingredient.quantity);
      if (!/^\d+(?:\.\d+)?$/.test(quantity) || Number(quantity) <= 0) throw invalidResponse();
      return {
        id: text(ingredient.id),
        position: position(ingredient.position),
        name: text(ingredient.name),
        quantity,
        unit: text(ingredient.unit),
        note: nullableText(ingredient.note),
        changeReason: nullableText(ingredient.changeReason),
        observedEffect: nullableText(ingredient.observedEffect),
      };
    }).sort((a, b) => a.position - b.position),
    steps: data.steps.map((value) => {
      const step = object(value);
      return { id: text(step.id), position: position(step.position), instruction: text(step.instruction) };
    }).sort((a, b) => a.position - b.position),
  };
}

async function request(path: string, signal?: AbortSignal): Promise<unknown> {
  return apiRequest(path, { signal });
}

export async function getRecipes(signal?: AbortSignal): Promise<RecipeSummary[]> {
  const data = await request('/api/recipes', signal);
  if (!Array.isArray(data)) throw invalidResponse();
  return data.map(value => summary(value));
}

export async function getRecipe(id: string, signal?: AbortSignal): Promise<RecipeDetail> {
  if (!uuid.test(id)) throw new ApiError('This recipe link is invalid.', 400);
  return detail(await request(`/api/recipes/${encodeURIComponent(id)}`, signal));
}

function validId(id: string) {
  if (!uuid.test(id)) throw new ApiError('This recipe link is invalid.', 400);
  return encodeURIComponent(id);
}

export async function getMyRecipes(signal?: AbortSignal): Promise<RecipeSummary[]> {
  const data = await request('/api/me/recipes', signal);
  if (!Array.isArray(data)) throw invalidResponse();
  return data.map(value => summary(value, true));
}
export const getMyRecipe = async (id: string, signal?: AbortSignal) => detail(await request(`/api/me/recipes/${validId(id)}`, signal), true);
export async function createRecipe(title: string): Promise<string> {
  const data = object(await apiRequest('/api/recipes', { method: 'POST', body: { title } }));
  const id = text(data.id);
  validId(id);
  return id;
}
export async function saveRecipe(id: string, body: RecipeInput): Promise<void> {
  await apiRequest(`/api/me/recipes/${validId(id)}`, { method: 'PUT', body });
}
export async function saveExperiment(id: string, body: ExperimentInput): Promise<void> {
  await apiRequest(`/api/me/recipes/${validId(id)}/experiment`, { method: 'PATCH', body });
}
export async function forkRecipe(id: string): Promise<string> {
  const data = object(await apiRequest(`/api/recipes/${validId(id)}/fork`, { method: 'POST' }));
  const forkId = text(data.id);
  validId(forkId);
  return forkId;
}
export async function publishRecipe(id: string): Promise<void> {
  await apiRequest(`/api/me/recipes/${validId(id)}/publish`, { method: 'POST' });
}
export type Readiness = { readyToPublish: boolean; issues: { field: string; message: string }[] };
export async function getReadiness(id: string): Promise<Readiness> {
  const data = object(await request(`/api/me/recipes/${validId(id)}/publish-readiness`));
  if (typeof data.readyToPublish !== 'boolean' || !Array.isArray(data.issues)) throw invalidResponse();
  return { readyToPublish: data.readyToPublish, issues: data.issues.map(value => { const issue = object(value); return { field: text(issue.field), message: text(issue.message) }; }) };
}
export type RecipeInput = {
  title: string;
  ingredients: { name: string; quantity: string; unit: string; note?: string; changeReason: string | null; observedEffect: string | null }[];
  steps: { instruction: string }[];
};
export type ExperimentInput = { experimentGoal: string | null; experimentResult: string | null; experimentStatus: RecipeSummary['experimentStatus'] };
export type Change<T> = { type: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED'; before: T | null; after: T | null };
export type Comparison = {
  original: { id: string; title: string }; fork: { id: string; title: string };
  ingredients: Change<Omit<Ingredient, 'id'>>[];
  steps: Change<{ position: number; instruction: string }>[];
};
export async function getComparison(id: string, signal?: AbortSignal): Promise<Comparison> {
  const data = object(await request(`/api/me/recipes/${validId(id)}/compare`, signal));
  if (!Array.isArray(data.ingredients) || !Array.isArray(data.steps)) throw invalidResponse();
  function change<T>(value: unknown, decode: (row: Record<string, unknown>) => T): Change<T> {
    const item = object(value);
    if (!['ADDED','REMOVED','MODIFIED','UNCHANGED'].includes(text(item.type))) throw invalidResponse();
    const before = item.before === null ? null : decode(object(item.before));
    const after = item.after === null ? null : decode(object(item.after));
    if ((item.type === 'ADDED' && (before !== null || after === null)) ||
        (item.type === 'REMOVED' && (before === null || after !== null)) ||
        (['MODIFIED', 'UNCHANGED'].includes(item.type as string) && (before === null || after === null))) throw invalidResponse();
    return { type: item.type as Change<T>['type'], before, after };
  }
  const original = object(data.original), fork = object(data.fork);
  return {
    original: { id: text(original.id), title: text(original.title) }, fork: { id: text(fork.id), title: text(fork.title) },
    ingredients: data.ingredients.map(value => change(value, row => ({
      position: position(row.position), name: text(row.name), quantity: text(row.quantity), unit: text(row.unit),
      note: nullableText(row.note), changeReason: nullableText(row.changeReason), observedEffect: nullableText(row.observedEffect),
    }))),
    steps: data.steps.map(value => change(value, row => ({ position: position(row.position), instruction: text(row.instruction) }))),
  };
}
