import { useEffect, useRef, useState } from "react";
import { getRecipes, type RecipeSummary } from "../api/recipes";
import RecipeCard from "../components/RecipeCard";
import RequestMessage from "../components/RequestMessage";

type RecipeFilter = "all" | "original" | "variation";
type CatalogueState =
  | { status: "loading" }
  | { status: "success"; recipes: RecipeSummary[] }
  | { status: "error"; message: string };

export default function CataloguePage() {
  const [state, setState] = useState<CatalogueState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RecipeFilter>("all");
  const [attempt, setAttempt] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    getRecipes(controller.signal)
      .then((recipes) => {
        if (!controller.signal.aborted) setState({ status: "success", recipes });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: error instanceof Error ? error.message : "The recipe collection is unavailable." });
        }
      });

    return () => controller.abort();
  }, [attempt]);

  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  const filteredRecipes = state.status === "success"
    ? state.recipes.filter((recipe) => {
      const matchesQuery = `${recipe.title} ${recipe.author?.displayName ?? ""}`.toLocaleLowerCase("id-ID").includes(normalizedQuery);
      const matchesFilter = filter === "all" || (filter === "variation" ? Boolean(recipe.parentRecipeId) : !recipe.parentRecipeId);
      return matchesQuery && matchesFilter;
    })
    : [];

  function clearSearch() {
    setQuery("");
    setFilter("all");
    searchInput.current?.focus();
  }

  return (
    <>
      <section className="hero page-width" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Recipes to make your own</h1>
          <p className="hero-description">Start with a community recipe and try your changes in a private draft.</p>
          <a className="button hero-link" href="#collection">Browse recipes <span aria-hidden="true">↓</span></a>
        </div>
        <img
          className="hero-image"
          src="/images/persimmon-1200.webp"
          srcSet="/images/persimmon-640.webp 640w, /images/persimmon-1200.webp 1200w"
          sizes="(max-width: 44rem) 92vw, (max-width: 77rem) 50vw, 610px"
          width="1200"
          height="600"
          alt=""
          fetchPriority="high"
        />
      </section>

      <section id="collection" className="collection page-width" aria-labelledby="collection-title" tabIndex={-1}>
        <div className="section-heading">
          <h2 id="collection-title">Community recipes</h2>
        </div>
        <div className="collection-controls">
          <form className="search-form" role="search" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="recipe-search">Search recipes</label>
            <div className="search-field">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" /></svg>
              <input id="recipe-search" ref={searchInput} type="search" placeholder="Recipe or author name" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </form>
          <fieldset className="recipe-filters">
            <legend>Recipe type</legend>
            <div className="filter-options">
              <button className="button button-secondary" type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All recipes</button>
              <button className="button button-secondary" type="button" aria-pressed={filter === "original"} onClick={() => setFilter("original")}>Originals</button>
              <button className="button button-secondary" type="button" aria-pressed={filter === "variation"} onClick={() => setFilter("variation")}>Variations</button>
            </div>
          </fieldset>
        </div>

        {state.status === "loading" && <div className="loading-state" role="status">Loading recipes</div>}
        {state.status === "error" && <RequestMessage title="Could not load recipes" onRetry={() => setAttempt((value) => value + 1)}><p>{state.message}</p></RequestMessage>}
        {state.status === "success" && state.recipes.length === 0 && <RequestMessage title="No published recipes yet" />}
        {state.status === "success" && state.recipes.length > 0 && (
          <>
            <p className="result-count" aria-live="polite">{filteredRecipes.length} of {state.recipes.length} {state.recipes.length === 1 ? "recipe" : "recipes"}</p>
            {filteredRecipes.length > 0
              ? <div className="recipe-grid">{filteredRecipes.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} />)}</div>
              : <RequestMessage title="No matching recipes"><p>Try another search or change the recipe type.</p><button className="button button-secondary" type="button" onClick={clearSearch}>Clear search</button></RequestMessage>}
          </>
        )}
      </section>
    </>
  );
}
