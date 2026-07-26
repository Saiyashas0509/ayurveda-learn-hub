import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { LoadingScreen } from "@/components/loading-screen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Shown for both a route's beforeLoad/loader pending phase and any
    // React Suspense a route's own useSuspenseQuery calls trigger (each
    // matched route renders inside the router's own Suspense boundary, so
    // this one component covers every "still loading" moment app-wide).
    // Deliberately short/quick — most authenticated routes do a real
    // network round trip (auth check, then data) before they can render
    // anything, so without this there's a blank flash on nearly every
    // navigation.
    defaultPendingComponent: () => <LoadingScreen />,
    defaultPendingMs: 250,
    defaultPendingMinMs: 400,
  });

  return router;
};
