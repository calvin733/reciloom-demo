import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getComparison, type Change, type Comparison, type Ingredient } from '../api/recipes';
import RequestMessage from './RequestMessage';

const labels = { ADDED: 'Added', REMOVED: 'Removed', MODIFIED: 'Changed', UNCHANGED: 'Unchanged' };

export default function RecipeComparison({ recipeId }: { recipeId: string }) {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setComparison(null); setError('');
    getComparison(recipeId, controller.signal).then(data => { if (!controller.signal.aborted) setComparison(data); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The comparison is unavailable.'); });
    return () => controller.abort();
  }, [recipeId, attempt]);
  return <section className="compare-panel" aria-labelledby="compare-title">
    <header className="compare-heading"><h2 id="compare-title">Compare recipes</h2></header>
    {error ? <RequestMessage title="Could not load comparison" onRetry={() => setAttempt(value => value + 1)}><p>{error}</p></RequestMessage> : !comparison ? <div className="loading-state" role="status">Loading comparison</div> : <>
      <p className="helper-text">Compare your last saved version with <Link to={`/recipes/${comparison.original.id}`}>{comparison.original.title}</Link>, the recipe you forked.</p>
      <div className="compare-legend">{Object.entries(labels).map(([type, label]) => <span className={`change-badge change-${type.toLowerCase()}`} key={type}>{label} {[...comparison.ingredients, ...comparison.steps].filter(change => change.type === type).length}</span>)}</div>
      <h3>Ingredients</h3>
      {comparison.ingredients.length === 0 && <p>No ingredients to compare</p>}
      {comparison.ingredients.map((change, index) => <ChangeRow key={index} change={change} render={ingredient => <IngredientContent ingredient={ingredient} />} />)}
      <h3>Directions</h3>
      {comparison.steps.length === 0 && <p>No steps to compare</p>}
      {comparison.steps.map((change, index) => <ChangeRow key={index} change={change} render={step => <><strong>Step {step.position}</strong><p>{step.instruction}</p></>} />)}
    </>}
    <details className="compare-limits">
      <summary>How the comparison works</summary>
      <p>Ingredients match by name and unit, ignoring capitalization and spaces at the ends. A different name or unit appears as one removal and one addition. Grams and cups are compared as separate units.</p>
      <p>Amount and notes determine whether an ingredient is marked as changed. Reasons and observed effects are shown for context. Duplicate ingredients are matched in order. Steps are compared by position, so moving one can affect several rows.</p>
      <p>Each version is compared with the recipe it was forked from.</p>
    </details>
  </section>;
}

function ChangeRow<T>({ change, render }: { change: Change<T>; render: (item: T) => ReactNode }) {
  return <div className={`change-row change-row-${change.type.toLowerCase()}`}>
    <span className={`change-badge change-${change.type.toLowerCase()}`}>{labels[change.type]}</span>
    <div className="change-columns"><div><span className="change-side">Source recipe</span>{change.before === null ? <p className="helper-text">None</p> : render(change.before)}</div><div><span className="change-side">Your version</span>{change.after === null ? <p className="helper-text">None</p> : render(change.after)}</div></div>
  </div>;
}
function IngredientContent({ ingredient }: { ingredient: Omit<Ingredient, 'id'> }) {
  return <>
    <strong>{ingredient.name}</strong>
    <p>{ingredient.quantity} {ingredient.unit}</p>
    {(ingredient.note || ingredient.changeReason || ingredient.observedEffect) && (
      <dl className="ingredient-observations">
        {ingredient.note && <><dt>Note</dt><dd>{ingredient.note}</dd></>}
        {ingredient.changeReason && <><dt>Reason for change</dt><dd>{ingredient.changeReason}</dd></>}
        {ingredient.observedEffect && <><dt>Observed effect</dt><dd>{ingredient.observedEffect}</dd></>}
      </dl>
    )}
  </>;
}
