import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode; label?: string; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Bonisa] Render error:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex-1 flex items-center justify-center px-5 py-16">
        <div className="max-w-md w-full text-center space-y-5">
          <AlertTriangle className="h-10 w-10 mx-auto text-amber-500" strokeWidth={1.9} aria-hidden="true" />
          <div className="space-y-2">
            <h1 className="font-serif text-2xl">This {this.props.label ?? "page"} didn't load</h1>
            <p className="text-sm text-muted-foreground">
              Something went wrong on our side, not yours. Your account and your work are safe.
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={this.reset}>Try again</Button>
            <Button variant="outline" onClick={() => { window.location.href = "/dashboard"; }}>
              Go to dashboard
            </Button>
          </div>
          {import.meta.env.DEV && (
            <pre className="text-left text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-3 overflow-x-auto">
              {error.message}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;