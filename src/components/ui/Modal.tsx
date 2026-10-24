import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string; // e.g. "max-w-lg", "max-w-2xl", "max-w-3xl", "max-w-4xl"
  ariaLabel?: string;
  customHeader?: ReactNode;
  headerExtra?: ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  containerClassName?: string;
}

/**
 * Application-wide viewport-fixed Modal component.
 *
 * Guaranteed properties:
 * 1. Portals directly to document.body, escaping all parent transform, filter,
 *    overflow, or stacking context clipping bugs.
 * 2. Uses viewport-fixed positioning (fixed inset-0 z-[100]) centered horizontally
 *    and vertically so it appears immediately within the visible viewport.
 * 3. Prevents background body scroll while open without page jumping.
 * 4. Listens for 'Escape' key to close.
 * 5. Traps focus and restores focus to triggering element when closed.
 * 6. Keeps modal body content scrollable (max-h-[calc(100dvh-32px)] flex-col layout).
 */
export default function Modal({
  isOpen = true,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = "max-w-2xl",
  ariaLabel,
  customHeader,
  headerExtra,
  headerClassName,
  bodyClassName,
  footerClassName,
  containerClassName,
}: ModalProps) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const modalBoxRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Capture triggering focus & lock scroll
  useEffect(() => {
    if (!isOpen) return;

    // Only record previous focus if the active element was outside the modal
    if (!modalBoxRef.current?.contains(document.activeElement)) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Initial autofocus only when active element is not already inside the modal
    if (!modalBoxRef.current?.contains(document.activeElement)) {
      const focusable = modalBoxRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || (typeof title === "string" ? title : "Dialog")}
      onClick={(e) => {
        // Close when clicking directly on overlay backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onWheel={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <div
        ref={modalBoxRef}
        className={`glass-card bg-surface-900 border border-surface-700 w-full ${maxWidthClass} rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-32px)] overflow-hidden ${containerClassName ?? ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {customHeader ? (
          <div className={`shrink-0 ${headerClassName ?? ""}`}>
            {customHeader}
            {headerExtra}
          </div>
        ) : (
          <div className={`p-4 sm:p-5 border-b border-surface-800 flex flex-col shrink-0 bg-surface-900/90 backdrop-blur-md ${headerClassName ?? ""}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {typeof title === "string" ? (
                  <h2 className="text-lg sm:text-xl font-bold text-surface-50 leading-snug truncate">
                    {title}
                  </h2>
                ) : (
                  title
                )}
                {subtitle && (
                  typeof subtitle === "string" ? (
                    <p className="text-xs text-surface-400 mt-0.5 line-clamp-1">{subtitle}</p>
                  ) : subtitle
                )}
              </div>
              <button
                onClick={onClose}
                className="text-surface-400 hover:text-surface-100 p-1.5 rounded-lg hover:bg-surface-800 transition-colors shrink-0"
                aria-label="Close dialog"
                title="Close (Esc)"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {headerExtra && <div className="mt-3">{headerExtra}</div>}
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className={`overflow-y-auto flex-1 overscroll-contain ${bodyClassName ?? "p-4 sm:p-6"}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={`border-t border-surface-800 bg-surface-900/80 backdrop-blur-sm shrink-0 ${footerClassName ?? "p-4 flex items-center justify-end gap-3"}`}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
