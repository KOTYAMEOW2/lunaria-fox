"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; message: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || "Произошла ошибка." };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="sc-error-boundary">
          <div className="sc-error-icon">⚠</div>
          <h2>Ошибка загрузки данных</h2>
          <p>{this.state.message}</p>
          <p className="sc-error-hint">Попробуй перезагрузить страницу. Если ошибка повторяется — бот, возможно, не подключён.</p>
          <button className="sc-btn sc-btn-secondary" onClick={() => window.location.reload()}>
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
