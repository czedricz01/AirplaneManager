import { Component, ErrorInfo, ReactNode } from 'react';

/**
 * Keeps one broken screen from taking the whole game down.
 *
 * A render error in React unmounts the entire tree above it. The route planner
 * crash that shipped in an earlier build did exactly that: reading a field that
 * did not exist on a memoised fallback object threw during render, and the
 * player was left with a blank page and an unsaved month. There was no error
 * boundary anywhere in the project, so every such bug had that same blast
 * radius.
 *
 * Wrapping the screens individually means a fault stays inside the screen that
 * caused it: the rest of the game, including the capital and the fleet, is
 * still there, and `onReset` lets the player back out to somewhere that works.
 */

interface Props {
  children: ReactNode;
  /** Shown in the panel, e.g. "Route Planner". */
  label?: string;
  /** Rendered as a way out; usually "close this screen". */
  onReset?: () => void;
  resetLabel?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.label ?? 'app'}] render failed`, error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="p-6 bg-black text-aero-warn font-mono text-[12px] flex flex-col gap-3 items-start">
        <div className="text-[13px] font-bold tracking-wider">
          {this.props.label ? `${this.props.label} could not be displayed` : 'Something went wrong'}
        </div>
        <div className="text-white/60 max-w-[520px] leading-relaxed">
          The rest of the game is unaffected and your progress is intact. Close this
          screen and carry on; if it keeps happening, the message below identifies
          the fault.
        </div>
        <code className="text-white/40 text-[11px] break-all max-w-[520px]">
          {error.message || String(error)}
        </code>
        <button
          type="button"
          onClick={this.handleReset}
          className="mt-1 px-3 py-1.5 border border-aero-yellow/40 text-aero-yellow text-[11px] tracking-wider hover:bg-aero-yellow/10"
        >
          {this.props.resetLabel ?? 'CLOSE'}
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
