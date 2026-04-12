import { useEffect, useState } from "react";
import { Button, IconButton, MenuItem, Select, Stack, Typography } from "@mui/material";
import FirstPageIcon from "@mui/icons-material/FirstPage";
import LastPageIcon from "@mui/icons-material/LastPage";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useTranslation } from "react-i18next";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [];
  pages.push(1);
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

interface PaginationProps {
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** localStorage key prefix for remembering page size */
  storageKey?: string;
}

export default function Pagination({ count, page, pageSize, onPageChange, onPageSizeChange, storageKey }: PaginationProps) {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const start = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, count);
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  // Load saved page size from localStorage
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(`pageSize_${storageKey}`);
      if (saved) {
        const n = Number(saved);
        if (PAGE_SIZE_OPTIONS.includes(n) && n !== pageSize) onPageSizeChange(n);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const handlePageSizeChange = (size: number) => {
    onPageSizeChange(size);
    onPageChange(1);
    if (storageKey) {
      try { localStorage.setItem(`pageSize_${storageKey}`, String(size)); } catch {}
    }
  };

  if (count === 0) return null;

  const pageNums = getPageNumbers(page, totalPages);

  return (
    <Stack spacing={0.5} sx={{ py: 1.5, px: 2 }}>
      {/* Main row: Previous + page numbers + Next */}
      <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
        <Button
          size="small"
          disabled={isFirst}
          onClick={() => onPageChange(page - 1)}
          sx={{ minWidth: 0, textTransform: "none", fontSize: "0.8rem" }}
        >
          ← {t("pagination.previous")}
        </Button>

        <IconButton size="small" disabled={isFirst} onClick={() => onPageChange(1)} title={t("pagination.firstPage")}>
          <FirstPageIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton size="small" disabled={isFirst} onClick={() => onPageChange(page - 1)} title={t("pagination.previousPage")}>
          <ChevronLeftIcon sx={{ fontSize: 18 }} />
        </IconButton>

        {pageNums.map((p, i) =>
          p === "..." ? (
            <Typography key={`ellipsis-${i}`} variant="body2" color="text.disabled" sx={{ px: 0.5 }}>…</Typography>
          ) : (
            <IconButton
              key={p}
              size="small"
              onClick={() => onPageChange(p)}
              sx={{
                width: 28, height: 28, fontSize: "0.8rem",
                bgcolor: p === page ? "primary.main" : "transparent",
                color: p === page ? "primary.contrastText" : "text.primary",
                "&:hover": { bgcolor: p === page ? "primary.dark" : "action.hover" },
              }}
            >
              {p}
            </IconButton>
          )
        )}

        <IconButton size="small" disabled={isLast} onClick={() => onPageChange(page + 1)} title={t("pagination.nextPage")}>
          <ChevronRightIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton size="small" disabled={isLast} onClick={() => onPageChange(totalPages)} title={t("pagination.lastPage")}>
          <LastPageIcon sx={{ fontSize: 18 }} />
        </IconButton>

        <Button
          size="small"
          disabled={isLast}
          onClick={() => onPageChange(page + 1)}
          sx={{ minWidth: 0, textTransform: "none", fontSize: "0.8rem" }}
        >
          {t("pagination.next")} →
        </Button>
      </Stack>

      {/* Info row: range + page size */}
      <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5}>
        <Typography variant="caption" color="text.secondary">
          {t("pagination.showing", { start, end, total: count })}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" color="text.secondary">{t("pagination.perPage")}</Typography>
          <Select
            size="small"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            sx={{ fontSize: "0.75rem", height: 24, "& .MuiSelect-select": { py: 0, px: 1 } }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <MenuItem key={n} value={n} sx={{ fontSize: "0.75rem" }}>{n}</MenuItem>
            ))}
          </Select>
        </Stack>
      </Stack>
    </Stack>
  );
}

/** Hook for pagination state — returns [page, pageSize, setPage, setPageSize] */
export function usePagination(defaultSize = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultSize);
  return { page, pageSize, setPage, setPageSize };
}
