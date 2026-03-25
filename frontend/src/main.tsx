import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ToastContainer } from "react-toastify";
// @ts-ignore
import "react-toastify/dist/ReactToastify.css";
import "./i18n/i18n";
import App from "./App";
import { queryClient } from "./api/client/queryClient";
import { FirmProvider } from "./context/FirmContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <FirmProvider>
        <App />
        <ToastContainer position="bottom-right" autoClose={2500} limit={3} newestOnTop />
        <ReactQueryDevtools initialIsOpen={false} />
      </FirmProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
