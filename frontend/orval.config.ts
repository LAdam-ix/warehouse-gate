import { defineConfig } from "orval";

export default defineConfig({
  warehouse: {
    input: {
      target: "http://localhost:8000/api/schema/",
    },
    output: {
      mode: "tags-split",
      target: "./src/api/generated",
      schemas: "./src/api/generated/model",
      client: "react-query",
      httpClient: "axios",
      override: {
        mutator: {
          path: "./src/api/client/axiosInstance.ts",
          name: "axiosInstance",
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
});
