import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';

interface ExportMenuButtonProps {
  recordCount: number;
  recordLabel: string;
  onExportCsv: () => void;
  onExportPdf: () => void;
  disabled?: boolean;
}

export function ExportMenuButton({
  recordCount,
  recordLabel,
  onExportCsv,
  onExportPdf,
  disabled = false,
}: ExportMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const isDisabled = disabled || recordCount === 0;

  return (
    <div ref={containerRef} className="relative inline-block shrink-0">
      <button
        type="button"
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-lg border border-[#E2D7C8] bg-white px-3.5 py-2 text-xs font-semibold text-[#291D16] transition-colors hover:border-[#B45309] hover:text-[#B45309] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
      >
        <Download className="h-3.5 w-3.5 text-[#B45309]" />
        <span>Exportar</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#8C7768] transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-60 rounded-xl border border-[#E6DACB] bg-white p-1.5 shadow-xl shadow-[#291D16]/10"
        >
          <div className="border-b border-[#F2EAE0] px-3 py-2">
            <p className="text-[11px] font-medium text-[#7A6658]">
              Arquivar registros exibidos
            </p>
            <p className="font-mono text-xs font-semibold text-[#291D16] tabular-nums">
              {recordCount} {recordLabel}
            </p>
          </div>

          <div className="mt-1 space-y-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExportCsv();
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#FAF7F2]"
            >
              <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div>
                <p className="text-xs font-semibold text-[#291D16]">
                  Exportar CSV (Planilha)
                </p>
                <p className="text-[11px] text-[#7A6658]">
                  Compatível com Excel e contabilidade
                </p>
              </div>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExportPdf();
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#FAF7F2]"
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
              <div>
                <p className="text-xs font-semibold text-[#291D16]">
                  Exportar PDF (Relatório)
                </p>
                <p className="text-[11px] text-[#7A6658]">
                  Documento formatado para arquivo
                </p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
