import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui";

export interface AdminHeaderSkeletonProps {
  eyebrow?: boolean;
  titleWidth?: string;
  count?: boolean;
  ledeWidth?: string;
  /** Widths for the right-hand actions. One entry per button. */
  actions?: string[];
}

/** Mirrors `.admin-page-header`: title block on the left, actions on the right. */
export function AdminHeaderSkeleton({
  eyebrow = false,
  titleWidth = "14rem",
  count = false,
  ledeWidth,
  actions = [],
}: AdminHeaderSkeletonProps) {
  return (
    <header className="admin-page-header">
      <div>
        {eyebrow && (
          <div style={{ width: "5.5rem", maxWidth: "100%", marginBottom: "6px" }}>
            <Skeleton lines={1} height="11px" />
          </div>
        )}

        <div className="admin-page-title">
          <div style={{ width: titleWidth, maxWidth: "100%" }}>
            <Skeleton lines={1} height="clamp(33px, 4.4vw, 50px)" />
          </div>
          {count && (
            <div style={{ width: "2.5rem" }}>
              <Skeleton lines={1} height="15px" />
            </div>
          )}
        </div>

        {ledeWidth && (
          <div style={{ width: ledeWidth, maxWidth: "100%", marginTop: "14px" }}>
            <Skeleton lines={1} height="14px" />
          </div>
        )}
      </div>

      {actions.length > 0 && (
        <div className="specimen-inline-cluster">
          {actions.map((width, index) => (
            <div key={index} style={{ width }}>
              <Skeleton lines={1} height="44px" />
            </div>
          ))}
        </div>
      )}
    </header>
  );
}

export interface AdminToolbarSkeletonProps {
  variant: "albums" | "shares";
}

/** Mirrors the search, chips, and sort controls on the albums and shares pages. */
export function AdminToolbarSkeleton({ variant }: AdminToolbarSkeletonProps) {
  if (variant === "shares") {
    return (
      <div className="admin-toolbar" aria-hidden="true">
        <div style={{ flex: "1 1 220px", maxWidth: "320px" }}>
          <Skeleton lines={1} height="44px" />
        </div>
        <div style={{ width: "5.2rem" }}>
          <Skeleton lines={1} height="36px" />
        </div>
        <div className="admin-chips">
          {["2.8rem", "3.6rem", "4.8rem", "5.4rem", "4.2rem"].map((width) => (
            <span
              key={width}
              className="ui-skeleton-bar"
              style={{ width, height: "30px" }}
            />
          ))}
        </div>
        <div className="admin-chips admin-sort">
          {["4.2rem", "4.2rem"].map((width) => (
            <span
              key={width}
              className="ui-skeleton-bar"
              style={{ width, height: "30px" }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-toolbar" aria-hidden="true">
      <div style={{ flex: "1 1 220px", maxWidth: "320px" }}>
        <Skeleton lines={1} height="44px" />
      </div>
      <div className="admin-chips">
        {["2.5rem", "4.2rem", "3.2rem", "3.4rem"].map((width) => (
          <span
            key={width}
            className="ui-skeleton-bar"
            style={{ width, height: "30px" }}
          />
        ))}
      </div>
      <div className="admin-sort">
        <div style={{ width: "10rem" }}>
          <Skeleton lines={1} height="44px" />
        </div>
      </div>
    </div>
  );
}

export interface AdminSkeletonColumn {
  header: string;
  numeric?: boolean;
  /** The first cell of a row: a cover mark + two lines, or just two lines. */
  primary?: "cover" | "stacked";
  barWidth?: string;
  /** Right-align a non-numeric cell, such as an actions column. */
  end?: boolean;
}

export interface AdminTableSkeletonProps {
  label: string;
  columns: AdminSkeletonColumn[];
  rows?: number;
}

/** A ruled table with the same column labels and row height as the loaded table. */
export function AdminTableSkeleton({
  label,
  columns,
  rows = 3,
}: AdminTableSkeletonProps) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table" aria-label={label} aria-busy="true">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={`${column.header}-${index}`}
                scope="col"
                className={column.numeric ? "ui-table-num" : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column, columnIndex) => {
                const barWidth =
                  column.barWidth ?? (column.numeric || column.end ? "50%" : "80%");

                return (
                  <td
                    key={`${column.header}-${columnIndex}`}
                    className={column.numeric ? "ui-table-num" : undefined}
                  >
                    {column.primary === "cover" ? (
                      <span className="admin-table-title">
                        <span
                          className="ui-skeleton-bar"
                          style={{ width: "36px", height: "36px", flex: "0 0 auto" }}
                        />
                        <span
                          className="admin-table-primary"
                          style={{ flex: "1 1 auto", minWidth: 0, width: "100%" }}
                        >
                          <span
                            className="ui-skeleton-bar"
                            style={{ height: "14px", width: "70%" }}
                          />
                          <span
                            className="ui-skeleton-bar"
                            style={{ height: "12px", width: "45%" }}
                          />
                        </span>
                      </span>
                    ) : column.primary === "stacked" ? (
                      <span className="admin-table-primary" style={{ width: "100%" }}>
                        <span
                          className="ui-skeleton-bar"
                          style={{ height: "14px", width: "70%" }}
                        />
                        <span
                          className="ui-skeleton-bar"
                          style={{ height: "12px", width: "50%" }}
                        />
                      </span>
                    ) : (
                      <span
                        className="ui-skeleton-bar"
                        style={{
                          height: "14px",
                          width: barWidth,
                          marginLeft:
                            column.numeric || column.end ? "auto" : undefined,
                        }}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface AdminFieldSkeletonProps {
  labelWidth?: string;
  inputWidth?: string;
  hintWidth?: string | null;
}

/** One `.ui-field`: label, control, and hint. */
export function AdminFieldSkeleton({
  labelWidth = "8rem",
  inputWidth = "100%",
  hintWidth = "14rem",
}: AdminFieldSkeletonProps) {
  return (
    <div className="ui-field">
      <span
        className="ui-skeleton-bar"
        style={{ width: labelWidth, height: "13px" }}
      />
      <span
        className="ui-skeleton-bar"
        style={{ width: inputWidth, height: "44px" }}
      />
      {hintWidth && (
        <span
          className="ui-skeleton-bar"
          style={{ width: hintWidth, height: "12px" }}
        />
      )}
    </div>
  );
}

export interface AdminFieldsetSkeletonProps {
  titleWidth?: string;
  descriptionWidth?: string;
  children: ReactNode;
}

/** A ruled `.ui-fieldset` with a skeleton legend and description. */
export function AdminFieldsetSkeleton({
  titleWidth = "8rem",
  descriptionWidth = "22rem",
  children,
}: AdminFieldsetSkeletonProps) {
  return (
    <fieldset className="ui-fieldset">
      <legend className="ui-fieldset-legend">
        <span
          className="ui-skeleton-bar"
          style={{ display: "inline-block", width: titleWidth, height: "14px" }}
        />
      </legend>
      <div style={{ width: descriptionWidth, maxWidth: "100%", margin: "4px 0 16px" }}>
        <Skeleton lines={1} height="13px" />
      </div>
      <div className="ui-fieldset-body">{children}</div>
    </fieldset>
  );
}
