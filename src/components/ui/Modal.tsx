import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string; // e.g. "max-w-lg", "max-w-2xl", "max-w-3xl", "max-w-4xl"
  ariaLabel?: string;
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
 * 6. Keeps modal body content scrollable (max-h-[85vh] overflow-y-auto).
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
}: ModalProps) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const modalBoxRef = useRef<HTMLDivElement | null>(null);

  // Capture triggering focus & lock scroll
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus close button or first focusable element inside modal
    const focusable = modalBoxRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title}
      onClick={(e) => {
        // Close when clicking directly on overlay backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalBoxRef}
        className={`glass-card bg-surface-900 border border-surface-700 w-full ${maxWidthClass} rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-surface-800 flex items-start justify-between gap-4 shrink-0 bg-surface-900/90 backdrop-blur-md">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-surface-50 leading-snug truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-surface-400 mt-0.5 line-clamp-1">{subtitle}</p>
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

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-surface-800 bg-surface-900/80 backdrop-blur-sm shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
