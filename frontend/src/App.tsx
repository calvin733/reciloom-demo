import { useEffect, useRef, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import CataloguePage from "./pages/CataloguePage";
import RecipePage from "./pages/RecipePage";
import AuthPage from './pages/AuthPage';
import MyRecipesPage from './pages/MyRecipesPage';
import RecipeEditorPage from './pages/RecipeEditorPage';
import { AuthProvider, RequireAuth, useAuth } from './auth/AuthContext';

export default function App() {
  return <AuthProvider><AppLayout /></AuthProvider>;
}

function AppLayout() {
  const auth = useAuth();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  const inWorkspace = pathname === "/my-recipes" || pathname === "/recipes/new" || /^\/recipes\/[^/]+\/edit\/?$/.test(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);

  async function logout() {
    setLogoutBusy(true);
    setLogoutError("");
    try {
      await auth.logout();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Could not log out. Try again.");
    } finally {
      setLogoutBusy(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header id="top" className="site-header">
        <div className="header-inner page-width">
          <div className="brand-lockup">
            <Link className="brand" to="/" aria-label="ReciLoom home">
              ReciLoom
            </Link>
          </div>
          <nav className="app-nav" aria-label="Main navigation">
            <Link className="nav-link" to="/" aria-current={pathname === "/" ? "page" : !inWorkspace && pathname.startsWith("/recipes/") ? "location" : undefined}>Explore</Link>
            {auth.user && <Link className="nav-link" to="/my-recipes" aria-current={pathname === "/my-recipes" ? "page" : inWorkspace ? "location" : undefined}>My recipes</Link>}
          </nav>
          <div className="nav-account">
            {auth.restoring ? <span className="nav-user">Checking session</span> : auth.user ? <>
              <span className="nav-user">{auth.user.displayName}</span>
              <button className="button button-ghost" type="button" disabled={logoutBusy} onClick={logout}>{logoutBusy ? "Logging out" : "Log out"}</button>
            </> : <>
              <Link className="nav-link" to="/login" aria-current={pathname === "/login" ? "page" : undefined}>Log in</Link>
              <Link className="button button-secondary" to="/register" aria-current={pathname === "/register" ? "page" : undefined}>Sign up</Link>
            </>}
          </div>
        </div>
      </header>
      {logoutError && <p className="page-width shell-notice form-error" role="alert">{logoutError}</p>}
      {auth.error && !inWorkspace && <div className="page-width shell-notice session-notice"><p role="alert">{auth.error}</p><button className="button button-secondary" type="button" onClick={auth.retry}>Try again</button></div>}
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<CataloguePage />} />
          <Route path="/login" element={<AuthPage key="login" mode="login" />} />
          <Route path="/register" element={<AuthPage key="register" mode="register" />} />
          <Route path="/my-recipes" element={<RequireAuth><MyRecipesPage /></RequireAuth>} />
          <Route path="/recipes/new" element={<RequireAuth><RecipeEditorPage key="new" /></RequireAuth>} />
          <Route path="/recipes/:recipeId/edit" element={<RequireAuth><RecipeEditorPage /></RequireAuth>} />
          <Route path="/recipes/:recipeId" element={<RecipePage />} />
          <Route path="*" element={
            <section className="page-width message-page">
              <p className="eyebrow">404</p>
              <h1>Page not found</h1>
              <p>Check the address or go back to the recipe collection.</p>
              <Link className="button" to="/">Browse recipes</Link>
            </section>
          } />
        </Routes>
      </main>
      <footer className="site-footer page-width">
        <span className="footer-wordmark">ReciLoom</span>
        <a href="#top">Back to top <span aria-hidden="true">↑</span></a>
      </footer>
    </>
  );
}
