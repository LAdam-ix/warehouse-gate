import { createContext, useContext, useState } from "react";
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography,
} from "@mui/material";
import { useWarehouseSettings } from "../api/hooks";
import { useTranslation } from "react-i18next";

type ConfirmFn = (message: string, options?: { title?: string; confirmLabel?: string }) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(true));

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { data: settings } = useWarehouseSettings();
  const [state, setState] = useState<{
    message: string;
    title: string;
    confirmLabel: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm: ConfirmFn = (message, options) => {
    if (settings?.skipConfirm) return Promise.resolve(true);
    return new Promise((resolve) => {
      setState({
        message,
        title: options?.title ?? t("confirmDialog.confirm"),
        confirmLabel: options?.confirmLabel ?? t("confirmDialog.confirm"),
        resolve,
      });
    });
  };

  const handleClose = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!state} onClose={() => handleClose(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{state?.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{state?.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleClose(false)}>{t("confirmDialog.cancel")}</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleClose(true)}
            autoFocus
          >
            {state?.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
