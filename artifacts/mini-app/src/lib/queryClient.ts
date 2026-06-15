import { QueryClient } from "@tanstack/react-query";
import { axiosInstance } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export { axiosInstance as AXIOS_INSTANCE };
