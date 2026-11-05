import { Component } from "react";

// Without a boundary any render exception unmounts the whole app and the browser shows a blank white page.
// This shows the real error instead (and logs it to the console) so the failing page can be diagnosed.
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("SmartRide render error:", error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-xl p-8">
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <p className="font-bold">This page could not be displayed.</p>
          <p className="mt-1 break-words">{String(this.state.error?.message || this.state.error)}</p>
          <div className="mt-4 flex gap-3">
            <button type="button" className="rounded-lg bg-red-700 px-3 py-1.5 font-semibold text-white" onClick={() => this.setState({ error: null })}>Try again</button>
            <a className="rounded-lg border border-red-300 px-3 py-1.5 font-semibold" href="/">Go to dashboard</a>
          </div>
        </div>
      </div>
    );
  }
}
