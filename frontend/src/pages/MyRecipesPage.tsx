import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, getMyRecipes, type RecipeSummary } from '../api/recipes';
import { useAuth } from '../auth/AuthContext';
import RecipeCard from '../components/RecipeCard';
import RequestMessage from '../components/RequestMessage';

export default function MyRecipesPage() {
  const { user, expire } = useAuth();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    getMyRecipes(controller.signal).then(data => { if (!controller.signal.aborted) setRecipes(data); })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401) expire();
        else setError(reason instanceof Error ? reason.message : 'Your recipes are unavailable.');
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.id, attempt, expire]);
  const drafts = recipes.filter(recipe => recipe.status === 'DRAFT');
  const published = recipes.filter(recipe => recipe.status === 'PUBLISHED');
  const visible = tab === 'DRAFT' ? drafts : published;
  return <div className="page-width workspace-page">
    <header className="workspace-heading">
      <div><h1>My recipes</h1><p>Drafts are private until you publish them.</p></div>
      <Link className="button" to="/recipes/new">New recipe</Link>
    </header>
    <div className="recipe-tabs" role="group" aria-label="Recipe status">
      <button className="button button-secondary" type="button" aria-pressed={tab === 'DRAFT'} onClick={() => setTab('DRAFT')}>Drafts {!loading && !error && <span>{drafts.length}</span>}</button>
      <button className="button button-secondary" type="button" aria-pressed={tab === 'PUBLISHED'} onClick={() => setTab('PUBLISHED')}>Published {!loading && !error && <span>{published.length}</span>}</button>
    </div>
    {loading ? <div className="loading-state" role="status">Loading your recipes</div>
      : error ? <RequestMessage title="Could not load your recipes" onRetry={() => setAttempt(value => value + 1)}><p>{error}</p></RequestMessage>
      : visible.length === 0 ? (
        <RequestMessage title={tab === 'DRAFT' ? 'No drafts yet' : 'No published recipes yet'}>
          <p>{tab === 'DRAFT' ? 'Start a new recipe or fork one from the collection.' : 'Publish a finished draft to share it here.'}</p>
          {tab === 'DRAFT'
            ? <Link className="button button-secondary" to="/">Browse recipes</Link>
            : <button className="button button-secondary" type="button" onClick={() => setTab('DRAFT')}>View drafts</button>}
        </RequestMessage>
      ) : <div className="recipe-grid">{visible.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} inWorkspace />)}</div>}
  </div>;
}
