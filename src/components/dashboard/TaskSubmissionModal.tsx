import { useRef, useState } from "react";
import Modal from "../ui/Modal";
import { submitTaskForReview } from "../../services/taskSubmissionService";
import type { Task, TaskSubmission, TaskSubmissionPayload } from "../../types";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB total
const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TaskSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  defaultPrUrl?: string;
  onSuccess: (newSubmission: TaskSubmission) => void;
}

export default function TaskSubmissionModal({
  isOpen,
  onClose,
  task,
  defaultPrUrl,
  onSuccess,
}: TaskSubmissionModalProps) {
  const [form, setForm] = useState<TaskSubmissionPayload>({
    work_summary: "",
    implementation_details: "",
    testing_performed: "",
    pull_request_url: defaultPrUrl || "",
    deliverable_url: "",
    additional_comments: "",
  });

  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- file handling ----------

  const addFiles = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    setFileError(null);

    const newFiles: File[] = [];
    const errors: string[] = [];
    let wouldBeTotal = files.reduce((s, f) => s + f.size, 0);

    Array.from(incoming).forEach((f) => {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        errors.push(`"${f.name}" — unsupported type (${f.type || "unknown"})`);
        return;
      }
      if (f.size > MAX_FILE_BYTES) {
        errors.push(`"${f.name}" exceeds 10 MB limit`);
        return;
      }
      if (wouldBeTotal + f.size > MAX_TOTAL_BYTES) {
        errors.push(`Adding "${f.name}" would exceed the 25 MB total limit`);
        return;
      }
      // Deduplicate by name+size
      if (files.some((ex) => ex.name === f.name && ex.size === f.size)) return;
      wouldBeTotal += f.size;
      newFiles.push(f);
    });

    if (errors.length > 0) setFileError(errors.join(" · "));
    if (newFiles.length > 0) setFiles((prev) => [...prev, ...newFiles]);
    // Reset input so the same file can be re-added after removal
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setFileError(null);
  };

  const totalBytes = files.reduce((s, f) => s + f.size, 0);

  // ---------- form validation ----------

  const validate = (): boolean => {
    const errors: { [key: string]: string } = {};
    if (!form.work_summary.trim()) errors.work_summary = "Work summary is required.";
    if (!form.implementation_details.trim()) errors.implementation_details = "Implementation details are required.";
    if (!form.testing_performed.trim()) errors.testing_performed = "Testing details are required.";
    const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
    if (form.pull_request_url?.trim() && !urlRegex.test(form.pull_request_url.trim()))
      errors.pull_request_url = "Please enter a valid HTTP/HTTPS URL.";
    if (form.deliverable_url?.trim() && !urlRegex.test(form.deliverable_url.trim()))
      errors.deliverable_url = "Please enter a valid HTTP/HTTPS URL.";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ---------- submit ----------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload: TaskSubmissionPayload = {
        work_summary: form.work_summary.trim(),
        implementation_details: form.implementation_details.trim(),
        testing_performed: form.testing_performed.trim(),
        pull_request_url: form.pull_request_url?.trim() || null,
        deliverable_url: form.deliverable_url?.trim() || null,
        additional_comments: form.additional_comments?.trim() || null,
      };
      const submission = await submitTaskForReview(task.id, payload, files.length > 0 ? files : undefined);
      onSuccess(submission);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit task for review.");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- render ----------

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!submitting) onClose(); }}
      title="Submit Task for Review"
      subtitle={`Task: "${task.title}" • ${task.project_name || "Project Task"}`}
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        {error && (
          <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 p-3 rounded-lg text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Work Summary */}
        <div>
          <label className="block text-surface-300 text-xs font-semibold uppercase tracking-wider mb-1">
            Work Summary <span className="text-danger-400">*</span>
          </label>
          <textarea
            rows={2}
            value={form.work_summary}
            onChange={(e) => setForm({ ...form, work_summary: e.target.value })}
            placeholder="Briefly summarize what was accomplished in this task..."
            disabled={submitting}
            className={`w-full bg-surface-900 border ${
              validationErrors.work_summary ? "border-danger-500" : "border-surface-700"
            } rounded-lg p-2.5 text-xs text-surface-200 focus:outline-none focus:border-primary-500 placeholder:text-surface-600 resize-none`}
          />
          {validationErrors.work_summary && (
            <p className="text-danger-400 text-[11px] mt-1">{validationErrors.work_summary}</p>
          )}
        </div>

        {/* Implementation Details */}
        <div>
          <label className="block text-surface-300 text-xs font-semibold uppercase tracking-wider mb-1">
            Implementation Details <span className="text-danger-400">*</span>
          </label>
          <textarea
            rows={3}
            value={form.implementation_details}
            onChange={(e) => setForm({ ...form, implementation_details: e.target.value })}
            placeholder="Explain architectural changes, files modified, key logic implemented..."
            disabled={submitting}
            className={`w-full bg-surface-900 border ${
              validationErrors.implementation_details ? "border-danger-500" : "border-surface-700"
            } rounded-lg p-2.5 text-xs text-surface-200 focus:outline-none focus:border-primary-500 placeholder:text-surface-600 resize-none`}
          />
          {validationErrors.implementation_details && (
            <p className="text-danger-400 text-[11px] mt-1">{validationErrors.implementation_details}</p>
          )}
        </div>

        {/* Testing Performed */}
        <div>
          <label className="block text-surface-300 text-xs font-semibold uppercase tracking-wider mb-1">
            Testing Performed <span className="text-danger-400">*</span>
          </label>
          <textarea
            rows={2}
            value={form.testing_performed}
            onChange={(e) => setForm({ ...form, testing_performed: e.target.value })}
            placeholder="Describe unit tests, manual edge cases, and verification steps performed..."
            disabled={submitting}
            className={`w-full bg-surface-900 border ${
              validationErrors.testing_performed ? "border-danger-500" : "border-surface-700"
            } rounded-lg p-2.5 text-xs text-surface-200 focus:outline-none focus:border-primary-500 placeholder:text-surface-600 resize-none`}
          />
          {validationErrors.testing_performed && (
            <p className="text-danger-400 text-[11px] mt-1">{validationErrors.testing_performed}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pull Request URL */}
          <div>
            <label className="block text-surface-300 text-xs font-semibold uppercase tracking-wider mb-1">
              Pull Request URL{" "}
              <span className="text-surface-500 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={form.pull_request_url || ""}
              onChange={(e) => setForm({ ...form, pull_request_url: e.target.value })}
              placeholder="https://github.com/org/repo/pull/123"
              disabled={submitting}
              className={`w-full bg-surface-900 border ${
                validationErrors.pull_request_url ? "border-danger-500" : "border-surface-700"
              } rounded-lg p-2.5 text-xs text-surface-200 focus:outline-none focus:border-primary-500 placeholder:text-surface-600`}
            />
            {validationErrors.pull_request_url ? (
              <p className="text-danger-400 text-[11px] mt-1">{validationErrors.pull_request_url}</p>
            ) : (
              <p className="text-surface-500 text-[10px] mt-1">Not required for non-coding tasks.</p>
            )}
          </div>

          {/* Supporting Deliverable URL */}
          <div>
            <label className="block text-surface-300 text-xs font-semibold uppercase tracking-wider mb-1">
              Deliverable URL{" "}
              <span className="text-surface-500 font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              value={form.deliverable_url || ""}
              onChange={(e) => setForm({ ...form, deliverable_url: e.target.value })}
              placeholder="https://docs.google.com/... or Figma link"
              disabled={submitting}
              className={`w-full bg-surface-900 border ${
                validationErrors.deliverable_url ? "border-danger-500" : "border-surface-700"
              } rounded-lg p-2.5 text-xs text-surface-200 focus:outline-none focus:border-primary-500 placeholder:text-surface-600`}
            />
            {validationErrors.deliverable_url && (
              <p className="text-danger-400 text-[11px] mt-1">{validationErrors.deliverable_url}</p>
            )}
          </div>
        </div>

        {/* Additional Comments */}
        <div>
          <label className="block text-surface-300 text-xs font-semibold uppercase tracking-wider mb-1">
            Additional Comments{" "}
            <span className="text-surface-500 font-normal lowercase">(optional)</span>
          </label>
          <input
            type="text"
            value={form.additional_comments || ""}
            onChange={(e) => setForm({ ...form, additional_comments: e.target.value })}
            placeholder="Any context or notes for the project manager..."
            disabled={submitting}
            className="w-full bg-surface-900 border border-surface-700 rounded-lg p-2.5 text-xs text-surface-200 focus:outline-none focus:border-primary-500 placeholder:text-surface-600"
          />
        </div>

        {/* ── File Attachments ── */}
        <div>
          <label className="block text-surface-300 text-xs font-semibold uppercase tracking-wider mb-1">
            Attachments{" "}
            <span className="text-surface-500 font-normal lowercase">(optional — 10 MB/file · 25 MB total)</span>
          </label>

          {/* Drop zone / picker trigger */}
          <div
            role="button"
            tabIndex={submitting ? -1 : 0}
            aria-label="Add files"
            onClick={() => !submitting && fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && !submitting && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              if (!submitting) addFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
              submitting
                ? "border-surface-800 opacity-50 cursor-not-allowed"
                : "border-surface-700 hover:border-primary-500/60"
            }`}
          >
            <svg className="w-6 h-6 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-surface-400 text-xs">
              <span className="text-primary-400 font-medium">Click to browse</span> or drag &amp; drop
            </p>
            <p className="text-surface-600 text-[10px]">
              PNG, JPG, WEBP, PDF, TXT, CSV, DOC, DOCX, XLS, XLSX, ZIP
            </p>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(",")}
            disabled={submitting}
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />

          {/* File error */}
          {fileError && (
            <p className="text-danger-400 text-[11px] mt-1.5">⚠️ {fileError}</p>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {files.map((file, idx) => {
                const isImage = file.type.startsWith("image/");
                const previewUrl = isImage ? URL.createObjectURL(file) : null;
                return (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center gap-2 bg-surface-900/70 border border-surface-700/60 rounded-lg p-2"
                  >
                    {isImage && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={file.name}
                        className="w-10 h-10 rounded object-cover shrink-0 border border-surface-700"
                        onLoad={() => URL.revokeObjectURL(previewUrl)}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-surface-800 border border-surface-700 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-surface-200 text-[11px] font-medium truncate">{file.name}</p>
                      <p className="text-surface-500 text-[10px]">{formatBytes(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      disabled={submitting}
                      aria-label={`Remove ${file.name}`}
                      className="text-surface-500 hover:text-danger-400 transition-colors shrink-0 p-1 rounded"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}

              {/* Total size bar */}
              <div className="flex items-center justify-between text-[10px] text-surface-500 pt-0.5 px-0.5">
                <span>{files.length} file{files.length !== 1 ? "s" : ""} selected</span>
                <span className={totalBytes > MAX_TOTAL_BYTES ? "text-danger-400" : ""}>
                  {formatBytes(totalBytes)} / 25 MB total
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="pt-4 border-t border-surface-700/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-secondary text-xs px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || totalBytes > MAX_TOTAL_BYTES}
            className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Submitting...</span>
              </>
            ) : (
              <span>Submit for Review</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
