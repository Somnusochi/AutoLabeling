import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error: Error | null }

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
              <p className="text-lg font-semibold text-red-600">出了点问题</p>
              <p className="mt-2 text-sm text-gray-500">
                {this.state.error?.message ?? "未知错误"}
              </p>
              <button
                type="button"
                className="mt-4 rounded bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                重试
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
