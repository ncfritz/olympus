"use client";

import { ClockCircleOutlined } from "@ant-design/icons";
import { Alert, Button, Progress, theme, Tooltip } from "antd";
import { useSyncExternalStore } from "react";
import { useCurrentUser } from "@/lib/api/queries";
import {
  clockOf,
  type Recent,
  type RecentState,
  recentOf,
  signInAgain,
  signInHref,
} from "@/lib/recentSignIn";
import styles from "./RecentSignIn.module.css";

/*
 * One clock for the page, ticking each second, so the header and a
 * notice always show the same time left.
 */
let now = Date.now();
const listeners = new Set<() => void>();
let ticking: number | undefined;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  ticking ??= window.setInterval(() => {
    now = Date.now();
    listeners.forEach((l) => l());
  }, 1000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(ticking);
      ticking = undefined;
    }
  };
};
const useNow = () =>
  useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );

/**
 * Where the current user's recent sign-in stands, on the page's clock;
 * undefined until the user is known.
 */
export const useRecentSignIn = (): Recent | undefined => {
  const { data } = useCurrentUser();
  const at = useNow();
  return data ? recentOf(data.signedInAt, data.recentUntil, at) : undefined;
};

/**
 * The countdown's colour, from antd's own status colours: the header's
 * green while open; a notice's bar takes its own (info) colour.
 */
const useColourOf = (open: "success" | "info" = "success") => {
  const { token } = theme.useToken();
  return (state: RecentState) =>
    state === "open"
      ? open === "success"
        ? token.colorSuccess
        : token.colorInfo
      : state === "ending"
        ? token.colorWarning
        : token.colorError;
};

/**
 * Signs in again in a small window, the page left as it is. A browser
 * that will not open one even for a click gets the whole-page sign-in,
 * back to this page.
 */
const signInFromClick = async () => {
  if ((await signInAgain()) === "blocked") {
    window.location.assign(signInHref());
  }
};

/** "Sign in again", for a notice or a refusal. */
export function SignInAgainButton({ primary = false }: { primary?: boolean }) {
  return (
    <Button
      size="small"
      type={primary ? "primary" : "default"}
      onClick={() => void signInFromClick()}
    >
      Sign in again
    </Button>
  );
}

const WHAT =
  "Ceremonies, changes to CAs, profiles and deploy targets, and key export need a sign-in from the last few minutes";

/**
 * The header's countdown, beside the signer's seal: how long changes may
 * still be made before signing in again; once lapsed, a link that does.
 */
export function RecentSignInCountdown() {
  const recent = useRecentSignIn();
  const colourOf = useColourOf();
  if (!recent) return null;
  if (recent.state === "lapsed") {
    return (
      <Tooltip title={WHAT}>
        <Button
          type="link"
          size="small"
          icon={<ClockCircleOutlined />}
          className={styles.lapsed}
          onClick={() => void signInFromClick()}
        >
          Sign in again
        </Button>
      </Tooltip>
    );
  }
  return (
    <Tooltip title={WHAT}>
      <div
        className={styles.countdown}
        role="timer"
        aria-label={`Recent sign-in: ${clockOf(recent.remainingMs)} left`}
      >
        <div className={styles.row}>
          <span>Recent sign-in</span>
          <span className={styles.left}>{clockOf(recent.remainingMs)}</span>
        </div>
        <Progress
          percent={recent.fraction * 100}
          showInfo={false}
          size={[150, 3]}
          strokeColor={colourOf(recent.state)}
          railColor="rgba(255, 255, 255, 0.16)"
        />
      </div>
    </Tooltip>
  );
}

/**
 * The notice at the top of a page whose changes need a recent sign-in,
 * below its heading: the time left while it lasts, then a request to sign
 * in again before saving. Saving after it lapses signs in first (the API
 * client's retry), so nothing typed is lost either way.
 */
export function RecentSignInNotice({ doing }: { doing: string }) {
  const recent = useRecentSignIn();
  const colourOf = useColourOf("info");
  const { isOperator } = useCurrentUser();
  if (!recent || !isOperator) return null;
  const bar = (
    <Progress
      className={styles.bar}
      percent={recent.fraction * 100}
      showInfo={false}
      size={["100%", 4]}
      strokeColor={colourOf(recent.state)}
    />
  );
  const left = (
    <span className={styles.clock}>{clockOf(recent.remainingMs)}</span>
  );
  if (recent.state === "lapsed") {
    return (
      <Alert
        type="error"
        showIcon
        icon={<ClockCircleOutlined />}
        title="Sign in again before saving"
        description={`Your recent sign-in has lapsed. Nothing is lost: saving opens the sign-in in a small window first, then saves.`}
        action={<SignInAgainButton primary />}
      />
    );
  }
  if (recent.state === "ending") {
    return (
      <Alert
        type="warning"
        showIcon
        icon={<ClockCircleOutlined />}
        title={<>Your recent sign-in ends in {left}</>}
        description={
          <>
            Sign in again now to keep going: it opens in a small window, and
            this page stays as it is.
            {bar}
          </>
        }
        action={<SignInAgainButton primary />}
      />
    );
  }
  return (
    <Alert
      type="info"
      showIcon
      icon={<ClockCircleOutlined />}
      title={<>Saving here needs a recent sign-in: {left} left</>}
      description={
        <>
          {doing}, like every change to CAs, profiles and keys, needs a sign-in
          from the last few minutes.
          {bar}
        </>
      }
      action={<SignInAgainButton />}
    />
  );
}
