import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { safeReturnTo, useAuth } from '../auth/AuthContext';

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const destination = safeReturnTo(params.get('returnTo'));
  const registering = mode === 'register';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (registering) await auth.register(name.trim(), email.trim(), password);
      else await auth.login(email.trim(), password);
      setPassword(''); navigate(destination, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not complete your request. Try again.');
    } finally { setBusy(false); }
  }
  if (auth.restoring) return <div className="page-width loading-state" role="status">Checking session</div>;
  if (auth.user) return <Navigate replace to={destination} />;
  return <section className="page-width auth-layout" aria-labelledby="auth-title">
    <header className="auth-heading">
      <h1 id="auth-title">{registering ? 'Create an account' : 'Log in to ReciLoom'}</h1>
      <p>{destination.includes('continueFork=1')
        ? 'You’ll return to the recipe to finish making a copy.'
        : registering ? 'Keep private drafts and share your recipes.' : 'Manage your drafts and published recipes.'}</p>
    </header>
    <div className="form-card">
      <form onSubmit={submit}><fieldset disabled={busy} className="form-fields">
        {registering && <label>Display name<input autoComplete="nickname" value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={100} /></label>}
        <label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} /></label>
        <label>Password<input type="password" autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={registering ? 12 : 1} maxLength={128} aria-describedby={registering ? 'password-help' : undefined} /></label>
        {registering && <p className="helper-text field-help" id="password-help">Use 12 to 128 characters</p>}
        {error && <div className="form-error" role="alert">
          <p>{error}</p>
          {registering && <p>If you already created an account, log in with the same email.</p>}
        </div>}
        <button className="button" type="submit">{registering ? (busy ? 'Creating account' : 'Create account') : (busy ? 'Logging in' : 'Log in')}</button>
      </fieldset></form>
      <p className="auth-switch">{registering ? 'Already have an account?' : 'New to ReciLoom?'} <Link to={`${registering ? '/login' : '/register'}?returnTo=${encodeURIComponent(destination)}`}>{registering ? 'Log in' : 'Sign up'}</Link></p>
    </div>
  </section>;
}
