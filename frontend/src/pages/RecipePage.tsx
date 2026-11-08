import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiError, forkRecipe, getMyRecipe, getRecipe, type RecipeDetail } from "../api/recipes";
import RequestMessage from "../components/RequestMessage";
import RecipeComparison from '../components/RecipeComparison';
import { useAuth } from '../auth/AuthContext';

type DetailState =
  | { status: "loading" }
  | { status: "success"; recipe: RecipeDetail }
  | { status: "error"; message: string; notFound: boolean };

const experimentLabels = {
  NOT_TESTED: "Not tested",
  SUCCESS: "Worked",
  FAILED: "Didn't work",
};

export default function RecipePage() {
  const { recipeId } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [forking, setForking] = useState(false);
  const [forkError, setForkError] = useState('');
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    if (auth.restoring) return () => controller.abort();
    setState({ status: "loading" });
    setComparing(false); setForkError('');
    getRecipe(recipeId ?? "", controller.signal)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404 && auth.user) return getMyRecipe(recipeId ?? '', controller.signal);
        throw error;
      })
      .then((recipe) => {
        if (!controller.signal.aborted) setState({ status: "success", recipe });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: error instanceof Error ? error.message : "This recipe is unavailable.", notFound: error instanceof ApiError && error.status === 404 });
        }
      });
    return () => controller.abort();
  }, [recipeId, attempt, auth.restoring, auth.user?.id]);

  const continuation = `/recipes/${recipeId}?continueFork=1`;
  const continuing = Boolean(auth.user && params.get('continueFork') === '1');
  async function fork() {
    if (!auth.user) { navigate(`/login?returnTo=${encodeURIComponent(continuation)}`); return; }
    setForking(true); setForkError('');
    try { navigate(`/recipes/${await forkRecipe(recipeId ?? '')}/edit`); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        auth.expire(); navigate(`/login?returnTo=${encodeURIComponent(continuation)}`);
      } else setForkError(error instanceof Error ? error.message : 'Could not create a draft copy. Try again.');
    } finally { setForking(false); }
  }

  const recipe = state.status === "success" ? state.recipe : null;
  const forkPanel = recipe?.status === 'PUBLISHED' && <>
    <div className="recipe-actions">
      <div><h2>Make your own version</h2><p>Fork this recipe to start with a private copy you can edit.</p></div>
      <div className="continuation-actions">
        <button className="button" type="button" disabled={forking || auth.restoring} onClick={() => void fork()}>
          {forking ? 'Creating draft' : continuing ? 'Continue to fork' : 'Fork recipe'}
        </button>
        {continuing && <button className="button button-ghost" type="button" disabled={forking} onClick={() => {
          const next = new URLSearchParams(params);
          next.delete('continueFork');
          setParams(next, { replace: true });
          document.getElementById('recipe-title')?.focus({ preventScroll: true });
        }}>Dismiss</button>}
      </div>
    </div>
    {forkError && <p className="form-error" role="alert">{forkError}</p>}
  </>;
  const headingNotice = recipe?.status === 'DRAFT'
    ? <div className="source-notice"><p>Only you can see this draft.</p><Link className="text-link" to={`/recipes/${recipeId}/edit`}>Edit draft <span aria-hidden="true">→</span></Link></div>
    : continuing && forkPanel;

  return (
    <div className="recipe-page page-width">
      <Link className="back-link" to="/"><span aria-hidden="true">←</span> Back to recipes</Link>
      {state.status === "loading" && <div className="loading-state" role="status">Loading recipe</div>}
      {state.status === "error" && <RequestMessage title={state.notFound ? "Recipe not found" : "Could not load recipe"} onRetry={state.notFound ? undefined : () => setAttempt((value) => value + 1)}>
        <p>{state.notFound ? "This recipe may be private or no longer available." : state.message}</p>
        {state.notFound && <Link className="button" to="/">Browse recipes</Link>}
      </RequestMessage>}
      {recipe && (
        <RecipeContent recipe={recipe} headingNotice={headingNotice}>
          {!continuing && forkPanel}
          {auth.user?.id === recipe.authorId && recipe.parentRecipeId && <>
            <div className="compare-toggle">
              <button className="button button-secondary" type="button" aria-expanded={comparing} aria-controls="recipe-comparison" onClick={() => setComparing(value => !value)}>{comparing ? 'Hide comparison' : 'Compare with source recipe'}</button>
            </div>
            <div id="recipe-comparison" hidden={!comparing}>{comparing && <RecipeComparison recipeId={recipe.id} />}</div>
          </>}
        </RecipeContent>
      )}
    </div>
  );
}

function RecipeContent({ recipe, headingNotice, children }: { recipe: RecipeDetail; headingNotice: ReactNode; children: ReactNode }) {
  const createdDate = new Date(recipe.createdAt);
  const hasExperiment = Boolean(recipe.parentRecipeId || recipe.experimentGoal || recipe.experimentResult);

  return (
    <article>
      <header className="recipe-heading">
        <p className="eyebrow">{recipe.parentRecipeId ? "Variation" : "Original recipe"}</p>
        <h1 id="recipe-title" tabIndex={-1}>{recipe.title}</h1>
        <div className="recipe-byline">
          <span>{recipe.author ? <>By <strong>{recipe.author.displayName}</strong></> : "Unknown author"}</span>
          {!Number.isNaN(createdDate.getTime()) && <span>Created <time dateTime={recipe.createdAt}>{new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(createdDate)}</time></span>}
        </div>
        {recipe.parentRecipeId && <Link className="source-link" to={`/recipes/${recipe.parentRecipeId}`}>View source recipe <span aria-hidden="true">→</span></Link>}
      </header>
      {headingNotice}
      <div className="recipe-body">
        <section className="ingredients-panel" aria-labelledby="ingredients-title">
          <div className="detail-section-heading"><h2 id="ingredients-title">Ingredients</h2><span>{recipe.ingredients.length} {recipe.ingredients.length === 1 ? "ingredient" : "ingredients"}</span></div>
          {recipe.ingredients.length === 0 ? <p>No ingredients listed</p> : <ul className="ingredient-list">{recipe.ingredients.map((ingredient) => (
            <li key={ingredient.id}>
              <div className="ingredient-line"><strong>{ingredient.name}</strong><span>{ingredient.quantity} {ingredient.unit}</span></div>
              {ingredient.note && <p className="ingredient-note">{ingredient.note}</p>}
              {(ingredient.changeReason || ingredient.observedEffect) && <dl className="ingredient-observations">{ingredient.changeReason && <><dt>Reason for change</dt><dd>{ingredient.changeReason}</dd></>}{ingredient.observedEffect && <><dt>Observed effect</dt><dd>{ingredient.observedEffect}</dd></>}</dl>}
            </li>
          ))}</ul>}
        </section>
        <section className="steps-panel" aria-labelledby="steps-title">
          <div className="detail-section-heading"><h2 id="steps-title">Directions</h2><span>{recipe.steps.length} {recipe.steps.length === 1 ? "step" : "steps"}</span></div>
          {recipe.steps.length === 0 ? <p>No directions listed</p> : <ol className="step-list">{recipe.steps.map(step => <li key={step.id}><p>{step.instruction}</p></li>)}</ol>}
        </section>
      </div>
      {hasExperiment && <section className="experiment-panel" aria-labelledby="experiment-title">
        <div><h2 id="experiment-title">Experiment notes</h2><span className={`experiment-status experiment-${recipe.experimentStatus.toLowerCase()}`}>{experimentLabels[recipe.experimentStatus]}</span></div>
        {recipe.experimentGoal || recipe.experimentResult ? (
          <dl>{recipe.experimentGoal && <><dt>Goal</dt><dd>{recipe.experimentGoal}</dd></>}{recipe.experimentResult && <><dt>Result</dt><dd>{recipe.experimentResult}</dd></>}</dl>
        ) : <p className="helper-text">No experiment notes yet</p>}
      </section>}
      {children}
    </article>
  );
}
