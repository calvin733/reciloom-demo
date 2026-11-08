import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiError, createRecipe, getMyRecipe, getReadiness, publishRecipe, saveExperiment, saveRecipe } from '../api/recipes';
import { useAuth } from '../auth/AuthContext';
import { draftIssues, emptyForm, formatFieldIssue, fromRecipe, moveRow, newIngredient, newStep, publishIssues, toExperiment, toPayload, type IngredientRow, type RecipeForm } from '../editor/recipe-form';
import RequestMessage from '../components/RequestMessage';

export default function RecipeEditorPage() {
  const { recipeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, expire } = useAuth();
  const [form, setForm] = useState<RecipeForm>(emptyForm);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [currentId, setCurrentId] = useState(recipeId);
  const [parentId, setParentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(recipeId));
  const [loadError, setLoadError] = useState('');
  const [published, setPublished] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [serverIssues, setServerIssues] = useState<string[]>([]);
  const [notice, setNotice] = useState(location.state?.saved ? 'Draft saved' : '');
  const errorSummary = useRef<HTMLDivElement>(null);
  const isFork = Boolean(parentId);
  const incomplete = publishIssues(form, isFork);
  const dirty = savedSnapshot ? JSON.stringify(form) !== savedSnapshot : Boolean(form.title || form.ingredients.some(row => row.name || row.quantity || row.unit || row.note || row.changeReason || row.observedEffect) || form.steps.some(row => row.instruction) || form.experimentGoal || form.experimentResult || form.experimentStatus !== 'NOT_TESTED');

  useEffect(() => {
    const controller = new AbortController();
    if (!recipeId) return () => controller.abort();
    setLoading(true); setLoadError(''); setPublished(false); setNeedsLogin(false);
    getMyRecipe(recipeId, controller.signal).then(recipe => {
      if (controller.signal.aborted) return;
      const initial = fromRecipe(recipe);
      setForm(initial); setSavedSnapshot(JSON.stringify(initial)); setParentId(recipe.parentRecipeId);
      setCurrentId(recipeId); setPublished(recipe.status === 'PUBLISHED');
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) {
        setLoadError(reason instanceof Error ? reason.message : 'This draft is unavailable.');
        setNeedsLogin(reason instanceof ApiError && reason.status === 401);
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [recipeId, attempt, user?.id]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (error) errorSummary.current?.focus();
  }, [error]);

  function update<K extends keyof RecipeForm>(field: K, value: RecipeForm[K]) {
    setForm(previous => ({ ...previous, [field]: value })); setNotice(''); setServerIssues([]);
  }
  function ingredient(index: number, field: keyof Omit<IngredientRow, 'key'>, value: string) {
    update('ingredients', form.ingredients.map((row, position) => position === index ? { ...row, [field]: value } : row));
  }
  async function save(andPublish = false) {
    const validation = andPublish ? publishIssues(form, isFork) : draftIssues(form, isFork);
    setError(''); setNotice(''); setServerIssues(validation); setNeedsLogin(false);
    if (validation.length) { setError('Check these fields'); return; }
    setBusy(true);
    let contentSaved = false;
    try {
      const id = currentId ?? await createRecipe(form.title.trim());
      setCurrentId(id); // Jika PUT gagal setelah create, retry memakai draft yang sama.
      await saveRecipe(id, toPayload(form));
      contentSaved = true;
      if (isFork) await saveExperiment(id, toExperiment(form));
      setSavedSnapshot(JSON.stringify(form));
      setNotice('Draft saved');
      const readiness = await getReadiness(id);
      if (andPublish) {
        if (!readiness.readyToPublish) { setServerIssues(readiness.issues.map(issue => issue.message)); setError('Draft saved. Complete these items before publishing.'); return; }
        await publishRecipe(id);
        navigate(`/recipes/${id}`, { replace: true });
      } else if (!recipeId) {
        navigate(`/recipes/${id}/edit`, { replace: true, state: { saved: true } });
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not finish saving.';
      setError(`${contentSaved ? 'Recipe details saved. ' : ''}${message}`);
      setNeedsLogin(reason instanceof ApiError && reason.status === 401);
      if (reason instanceof ApiError) setServerIssues(reason.issues.map(issue => formatFieldIssue(form, issue)));
    } finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void save(); }

  if (loading) return <div className="page-width loading-state" role="status">Loading draft</div>;
  const loginAgain = <Link onClick={expire} to={`/login?returnTo=${encodeURIComponent(currentId ? `/recipes/${currentId}/edit` : location.pathname)}`}>Log in again</Link>;
  if (loadError) return <div className="page-width"><RequestMessage title="Could not open draft" onRetry={() => setAttempt(value => value + 1)}><p>{loadError}</p>{needsLogin && <p>{loginAgain}</p>}<Link to="/my-recipes">Back to my recipes</Link></RequestMessage></div>;
  if (published) return <section className="page-width message-page"><h1>Recipe already published</h1><p>Fork the published recipe to make changes in a new draft.</p><Link className="button" to={`/recipes/${recipeId}`}>View recipe</Link></section>;

  return <div className="page-width workspace-page editor-page">
    <Link className="back-link" to="/my-recipes"><span aria-hidden="true">←</span> My recipes</Link>
    <header className="workspace-heading">
      <div>{currentId && <p className="eyebrow">{isFork ? 'Draft variation' : 'Draft'}</p>}<h1>{currentId ? 'Edit recipe' : 'New recipe'}</h1></div>
      {currentId && <Link className="text-link" to={`/recipes/${currentId}`}>{isFork ? 'Preview and compare' : 'Preview recipe'} <span aria-hidden="true">→</span></Link>}
    </header>
    {parentId && <div className="source-notice"><p>Edits apply to your draft only.</p><Link className="text-link" to={`/recipes/${parentId}`}>View source recipe <span aria-hidden="true">→</span></Link></div>}
    <form onSubmit={submit} className="editor-layout">
      <fieldset disabled={busy} className="editor-fields">
        <section className="editor-section" aria-labelledby="edit-identity">
          <h2 id="edit-identity">Recipe details</h2>
          <label>Recipe title<input value={form.title} onChange={event => update('title', event.target.value)} maxLength={150} placeholder="Honey milk bread" aria-describedby="title-help" required /></label>
          <p className="helper-text field-help" id="title-help">{form.title.length} of 150 characters. Use at least 3 to publish.</p>
        </section>
        <section className="editor-section" aria-labelledby="edit-ingredients">
          <div className="editor-section-heading"><h2 id="edit-ingredients">Ingredients</h2><span className="helper-text">{form.ingredients.length} of 50</span></div>
          {form.ingredients.map((row, index) => <div className="editor-row" key={row.key}>
            <div className="row-heading"><span>Ingredient {index + 1}</span><RowActions label={`ingredient ${index + 1}`} first={index === 0} last={index === form.ingredients.length - 1} onMove={direction => update('ingredients', moveRow(form.ingredients, index, direction))} onRemove={() => update('ingredients', form.ingredients.filter((_, position) => position !== index))} /></div>
            <div className="ingredient-inputs">
              <label>Ingredient name {index + 1}<input value={row.name} onChange={event => ingredient(index, 'name', event.target.value)} maxLength={150} placeholder="Flour" /></label>
              <label>Amount {index + 1}<input inputMode="decimal" value={row.quantity} onChange={event => ingredient(index, 'quantity', event.target.value)} placeholder="250" aria-describedby="quantity-help" /></label>
              <label>Unit {index + 1}<input value={row.unit} onChange={event => ingredient(index, 'unit', event.target.value)} maxLength={30} placeholder="g" /></label>
            </div>
            <details className="notes-disclosure">
              <summary>Ingredient notes {index + 1} <span>Optional</span></summary>
              <div className="form-fields">
                <label>Note for ingredient {index + 1}<textarea rows={2} value={row.note} maxLength={500} onChange={event => ingredient(index, 'note', event.target.value)} /></label>
                <label>Reason for change {index + 1}<textarea rows={2} value={row.changeReason} maxLength={1000} onChange={event => ingredient(index, 'changeReason', event.target.value)} /></label>
                <label>Observed effect {index + 1}<textarea rows={2} value={row.observedEffect} maxLength={2000} onChange={event => ingredient(index, 'observedEffect', event.target.value)} /></label>
              </div>
            </details>
          </div>)}
          <p className="helper-text" id="quantity-help">Enter a positive amount with up to 3 decimal places, such as 25.125. Blank rows are skipped when you save.</p>
          <button className="button button-secondary" type="button" disabled={form.ingredients.length >= 50} onClick={() => update('ingredients', [...form.ingredients, newIngredient()])}>Add ingredient</button>
        </section>
        <section className="editor-section" aria-labelledby="edit-steps">
          <div className="editor-section-heading"><h2 id="edit-steps">Directions</h2><span className="helper-text">{form.steps.length} of 50</span></div>
          {form.steps.map((row, index) => <div className="editor-row" key={row.key}>
            <div className="row-heading"><span>Step {index + 1}</span><RowActions label={`step ${index + 1}`} first={index === 0} last={index === form.steps.length - 1} onMove={direction => update('steps', moveRow(form.steps, index, direction))} onRemove={() => update('steps', form.steps.filter((_, position) => position !== index))} /></div>
            <label>Instructions for step {index + 1}<textarea rows={3} maxLength={5000} value={row.instruction} onChange={event => update('steps', form.steps.map((item, position) => position === index ? { ...item, instruction: event.target.value } : item))} /></label>
          </div>)}
          <button className="button button-secondary" type="button" disabled={form.steps.length >= 50} onClick={() => update('steps', [...form.steps, newStep()])}>Add step</button>
        </section>
        {isFork && <details className="editor-section notes-disclosure experiment-editor">
          <summary>Experiment notes <span>Optional</span></summary>
          <div className="form-fields">
            <label>Goal<textarea rows={3} maxLength={1000} value={form.experimentGoal} onChange={event => update('experimentGoal', event.target.value)} /></label>
            <label>Result<textarea rows={3} maxLength={3000} value={form.experimentResult} onChange={event => update('experimentResult', event.target.value)} /></label>
            <label>Experiment status<select value={form.experimentStatus} onChange={event => update('experimentStatus', event.target.value as RecipeForm['experimentStatus'])}>
              <option value="NOT_TESTED">Not tested</option>
              <option value="SUCCESS">Worked</option>
              <option value="FAILED">Didn't work</option>
            </select></label>
          </div>
        </details>}
      </fieldset>
      <aside className="save-panel" aria-labelledby="save-title">
        <h2 id="save-title">Save recipe</h2>
        <p className="helper-text">Save a private draft or publish the recipe for anyone to view.</p>
        <div className={`readiness ${incomplete.length ? 'readiness-pending' : 'readiness-ready'}`}>
          <h3>Publish checklist</h3>
          {incomplete.length ? <ul>{incomplete.map(issue => <li key={issue}>{issue}</li>)}</ul> : <p>Required fields complete</p>}
        </div>
        <div className="save-actions">
          <button className={`button${incomplete.length ? '' : ' button-secondary'}`} type="submit" disabled={busy}>{busy ? 'Saving recipe' : 'Save draft'}</button>
          <button className={`button${incomplete.length ? ' button-secondary' : ''}`} type="button" disabled={busy || incomplete.length > 0} onClick={() => void save(true)} aria-describedby="publish-help">Publish recipe</button>
        </div>
        <p className="helper-text" id="publish-help">After publishing, fork the recipe to make changes in a new draft.</p>
        {notice && <p className="form-success" role="status">{notice}</p>}
        {dirty && !busy && <p className="unsaved-note">Unsaved changes</p>}
        {error && <div className="form-error" role="alert" tabIndex={-1} ref={errorSummary}><p>{error}</p>{serverIssues.length > 0 && <ul>{serverIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}{needsLogin && <><p>Copy any unsaved changes before logging in again.</p>{loginAgain}</>}</div>}
      </aside>
    </form>
  </div>;
}

function RowActions({ label, first, last, onMove, onRemove }: { label: string; first: boolean; last: boolean; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  return <div className="row-actions"><button type="button" aria-label={`Move ${label} up`} disabled={first} onClick={() => onMove(-1)}>↑</button><button type="button" aria-label={`Move ${label} down`} disabled={last} onClick={() => onMove(1)}>↓</button><button type="button" className="remove-row" aria-label={`Remove ${label}`} onClick={onRemove}>Remove</button></div>;
}
