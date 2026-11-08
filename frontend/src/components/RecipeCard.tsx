import { useId } from "react";
import { Link } from "react-router-dom";
import type { RecipeSummary } from "../api/recipes";

type RecipeCardProps = {
  recipe: RecipeSummary;
  inWorkspace?: boolean;
};

export default function RecipeCard({ recipe, inWorkspace = false }: RecipeCardProps) {
  const titleId = useId();
  const isDraft = inWorkspace && recipe.status === "DRAFT";
  const action = isDraft ? "Edit draft" : "View recipe";
  const Heading = inWorkspace ? "h2" : "h3";
  const createdDate = new Date(recipe.createdAt);

  return (
    <article className="recipe-card">
      <p className="recipe-kind">{recipe.parentRecipeId ? "Variation" : "Original recipe"}</p>
      <Heading aria-labelledby={titleId}>
        <Link to={`/recipes/${recipe.id}${isDraft ? "/edit" : ""}`} aria-label={`${recipe.title}, ${action}`}>
          <span id={titleId}>{recipe.title}</span>
          <span className="card-action" aria-hidden="true">{action} <span>→</span></span>
        </Link>
      </Heading>
      {inWorkspace ? (
        !Number.isNaN(createdDate.getTime()) && <p className="card-author">Created <time dateTime={recipe.createdAt}>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(createdDate)}</time></p>
      ) : <p className="card-author">{recipe.author ? `By ${recipe.author.displayName}` : "Unknown author"}</p>}
    </article>
  );
}
