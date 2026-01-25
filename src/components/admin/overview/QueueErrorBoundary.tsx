import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
  queueName: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class QueueErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Log error to audit_logs (fire and forget)
    supabase
      .from("audit_logs")
      .insert({
        action: "error",
        entity: "admin_overview",
        metadata: {
          queue: this.props.queueName,
          error: error.message,
          stack: error.stack?.slice(0, 500),
        },
      })
      .then(() => {
        // Logged successfully
      });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-2 border-destructive/50 bg-destructive/5 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="font-medium text-destructive">
                Failed to load {this.props.queueName}
              </p>
              <p className="text-sm text-muted-foreground">
                {this.state.error?.message || "An unexpected error occurred"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}
