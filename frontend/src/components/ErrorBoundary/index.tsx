import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "i18next";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-semibold text-red-600">{i18n.t("errorBoundary.title")}</p>
              <p className="mt-2 text-sm text-gray-500">
                {this.state.error?.message ?? i18n.t("errorBoundary.unknownError")}
              </p>
              <button
                type="button"
                className="mt-4 rounded bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                {i18n.t("errorBoundary.retry")}
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
