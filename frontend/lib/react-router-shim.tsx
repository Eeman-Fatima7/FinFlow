"use client";

import React from "react";
import NextLink from "next/link";
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  replace?: boolean;
  prefetch?: boolean;
};

export function Link({ to, replace, prefetch, ...props }: LinkProps) {
  return <NextLink href={to} replace={replace} prefetch={prefetch} {...props} />;
}

type NavigateOptions = {
  replace?: boolean;
};

export function useNavigate() {
  const router = useRouter();

  return (to: string, options?: NavigateOptions) => {
    if (options?.replace) {
      router.replace(to);
      return;
    }

    router.push(to);
  };
}

export function useLocation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  return {
    pathname: pathname || "/",
    search: search ? `?${search}` : "",
    hash: "",
    state: null,
    key: "next",
  };
}

export function useParams<T extends Record<string, string | undefined>>() {
  const params = useNextParams();
  return params as unknown as T;
}

export function Outlet() {
  return null;
}

type Blocker = {
  state: "unblocked" | "blocked" | "proceeding";
  proceed: () => void;
  reset: () => void;
};

type BlockerArgs = {
  currentLocation: { pathname: string };
  nextLocation: { pathname: string; state?: unknown };
  historyAction: "PUSH" | "REPLACE" | "POP";
};

type BlockerFunction = (args: BlockerArgs) => boolean;

export function useBlocker(shouldBlock: BlockerFunction): Blocker;
export function useBlocker(args: BlockerArgs): Blocker;
export function useBlocker(input: BlockerFunction | BlockerArgs): Blocker {
  void input;

  return {
    state: "unblocked",
    proceed: () => {},
    reset: () => {},
  };
}

export function createBrowserRouter(routes: unknown[]) {
  return routes;
}

export function RouterProvider(args: { router: unknown }) {
  void args;

  return null;
}
