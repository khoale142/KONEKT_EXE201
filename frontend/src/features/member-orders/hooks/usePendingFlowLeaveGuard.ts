import { useEffect, useState } from "react";
import { useBlocker } from "react-router-dom";

type UsePendingFlowLeaveGuardOptions = {
  enabled: boolean;
};

export function usePendingFlowLeaveGuard({ enabled }: UsePendingFlowLeaveGuardOptions) {
  const blocker = useBlocker(enabled);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (blocker.state === "blocked") {
      setOpen(true);
      return;
    }

    if (blocker.state === "unblocked") {
      setOpen(false);
    }
  }, [blocker.state]);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled]);

  const stay = () => {
    setOpen(false);
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  };

  const leave = () => {
    setOpen(false);
    if (blocker.state === "blocked") {
      blocker.proceed();
    }
  };

  return {
    open,
    stay,
    leave,
  };
}
