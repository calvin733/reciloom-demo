import type { ReactNode } from "react";

type RequestMessageProps = {
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
};

export default function RequestMessage({ title, children, onRetry }: RequestMessageProps) {
  return (
    <div className="request-message" role={onRetry ? "alert" : undefined}>
      <h2>{title}</h2>
      {children}
      {onRetry && <button className="button button-secondary" type="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}
