"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

export interface UploadedFileItem {
  name: string;
  sizeBytes: number;
}

export interface FileDropzoneProps {
  id: string;
  label: string;
  hint: string;
  accept?: string;
  files: UploadedFileItem[];
  onAddFiles: (newFiles: UploadedFileItem[]) => void;
  onRemoveFile: (fileName: string) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function FileDropzone({
  id,
  label,
  hint,
  accept = ".pdf,.jpg,.png",
  files,
  onAddFiles,
  onRemoveFile,
  disabled = false,
  loading = false,
  error,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isInactive = disabled || loading;

  const extractList = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const items: UploadedFileItem[] = Array.from(fileList).map((f) => ({
      name: f.name,
      sizeBytes: f.size,
    }));
    onAddFiles(items);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    extractList(event.target.files);
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isInactive) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!isInactive) {
      extractList(event.dataTransfer.files);
    }
  };

  return (
    <div className="ui-dropzone-wrap">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`ui-dropzone ${isDragging ? "ui-dropzone-dragging" : ""} ${
          error ? "ui-dropzone-invalid" : ""
        } ${isInactive ? "ui-dropzone-disabled" : ""}`.trim()}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          multiple
          accept={accept}
          disabled={isInactive}
          onChange={handleChange}
          className="ui-dropzone-input"
        />
        <div className="ui-dropzone-copy">
          <svg className="ui-dropzone-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M10 13.5V4.5M10 4.5L6.5 8M10 4.5L13.5 8M4 14.5v1.5h12v-1.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <p className="ui-dropzone-title">{loading ? "Uploading event packet…" : label}</p>
            <p className="ui-dropzone-hint">{hint}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={isInactive}
          onClick={() => inputRef.current?.click()}
          className="ui-btn ui-btn-secondary ui-btn-sm"
        >
          Select files
        </button>
      </div>

      {error && (
        <p className="ui-field-error" role="alert">
          <span>{error}</span>
        </p>
      )}

      {files.length > 0 && (
        <ul className="ui-dropzone-list" aria-label="Selected files">
          {files.map((file) => (
            <li key={file.name} className="ui-dropzone-item">
              <span className="ui-dropzone-filename">{file.name}</span>
              <span className="ui-dropzone-filesize">{formatFileSize(file.sizeBytes)}</span>
              <button
                type="button"
                disabled={isInactive}
                onClick={() => onRemoveFile(file.name)}
                aria-label={`Remove ${file.name}`}
                className="ui-dropzone-remove"
              >
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M4.5 4.5l7 7M11.5 4.5l-7 7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
