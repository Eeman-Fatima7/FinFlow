import { useEffect } from "react";
import { useBlocker } from "react-router";

export function useUnsavedChanges(isDirty: boolean) {
  // Handle internal navigation blocking (React Router)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation, historyAction }) => {
      // If not dirty, don't block
      if (!isDirty) return false;
      
      // If path hasn't changed, don't block (e.g. query params or hash change might trigger? usually we want to allow those?)
      if (currentLocation.pathname === nextLocation.pathname) return false;

      // Fix for "POP navigation to a location that was not created by @remix-run/router"
      // If we are popping to a location that doesn't have router state, we shouldn't block
      // because React Router can't handle it gracefully and will fail silently/warn.
      // We rely on window.onbeforeunload (handled in useEffect) to catch these if they lead to document unload.
      if (historyAction === "POP" && (!nextLocation.state || (typeof nextLocation.state === 'object' && Object.keys(nextLocation.state as object).length === 0))) {
        return false;
      }

      return true;
    }
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      // Use window.confirm for simplicity, or could trigger a custom modal state here
      const confirm = window.confirm("You have unsaved changes. Discard them?");
      if (confirm) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  // Handle browser tab close / refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ""; // Required for Chrome
      }
    };

    if (isDirty) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);
}
