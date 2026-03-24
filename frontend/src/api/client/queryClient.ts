import { QueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
    mutations: {
      onError: (error: unknown) => {
        const msg =
          (error as { response?: { data?: { detail?: string } } })?.response
            ?.data?.detail ?? "Something went wrong.";
        toast.error(msg);
      },
    },
  },
});
