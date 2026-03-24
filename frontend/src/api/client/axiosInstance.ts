import axios from "axios";
import type { AxiosRequestConfig } from "axios";

export const axiosInstance = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Orval mutator — called for every generated API request
export default function customAxiosInstance<T>(
  config: AxiosRequestConfig
): Promise<T> {
  const source = axios.CancelToken.source();
  const promise = axiosInstance({ ...config, cancelToken: source.token }).then(
    (res) => res.data
  );
  // @ts-expect-error cancel token attachment
  promise.cancel = () => source.cancel("Query cancelled");
  return promise;
}
