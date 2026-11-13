"use client";

import type { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
}

export interface TabsProps {
  ariaLabel: string;
  tabs: TabItem[];
  activeId: string;
  onChange: (nextId: string) => void;
}

export interface AccordionItem {
  id: string;
  title: string;
  meta?: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  defaultOpenId?: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  disabled?: boolean;
}

export interface DataTableColumn {
  key: string;
  header: string;
  numeric?: boolean;
}

export interface DataTableProps {
  caption?: string;
  columns: DataTableColumn[];
  rows: Record<string, ReactNode>[];
  rowKeyField: string;
  loading?: boolean;
  emptyState?: ReactNode;
}

export interface PanelProps {
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function Tabs({ ariaLabel, tabs, activeId, onChange }: TabsProps) {
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className="ui-tabs">
      <div role="tablist" aria-label={ariaLabel} className="ui-tablist">
        {tabs.map((tab) => {
          const isSelected = tab.id === activeTab?.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={`ui-tab ${isSelected ? "ui-tab-active" : ""}`.trim()}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span className="ui-tab-count">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {activeTab && (
        <div
          id={`tabpanel-${activeTab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab.id}`}
          className="ui-tabpanel"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}

export function Accordion({ items, defaultOpenId }: AccordionProps) {
  return (
    <div className="ui-accordion">
      {items.map((item) => (
        <details
          key={item.id}
          open={item.id === defaultOpenId}
          className="ui-accordion-item"
        >
          <summary className="ui-accordion-summary">
            <span className="ui-accordion-title">{item.title}</span>
            {item.meta && <span className="ui-accordion-meta">{item.meta}</span>}
            <span className="ui-accordion-toggle" aria-hidden="true" />
          </summary>
          <div className="ui-accordion-body">{item.content}</div>
        </details>
      ))}
    </div>
  );
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="ui-breadcrumbs">
      <ol className="ui-breadcrumbs-list">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={item.label} className="ui-breadcrumbs-item">
              {item.href && !isLast ? (
                <a href={item.href} className="ui-breadcrumbs-link">
                  {item.label}
                </a>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className="ui-breadcrumbs-current">
                  {item.label}
                </span>
              )}
              {!isLast && (
                <svg
                  className="ui-breadcrumbs-sep"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4.25 10L7.75 2"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, idx) => idx + 1);

  return (
    <nav aria-label="Pagination" className="ui-pagination">
      <button
        type="button"
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
        className="ui-page-btn"
      >
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M10 3.5L5.5 8l4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Previous</span>
      </button>

      <div className="ui-page-numbers">
        {pages.map((p) => {
          const isCurrent = p === page;
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              aria-current={isCurrent ? "page" : undefined}
              onClick={() => onPageChange(p)}
              className={`ui-page-num ${isCurrent ? "ui-page-num-active" : ""}`.trim()}
            >
              {p}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={disabled || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
        className="ui-page-btn"
      >
        <span>Next</span>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M6 3.5L10.5 8 6 12.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </nav>
  );
}

export function DataTable({
  caption,
  columns,
  rows,
  rowKeyField,
  loading = false,
  emptyState,
}: DataTableProps) {
  if (!loading && rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        {caption && <caption className="ui-table-caption">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={col.numeric ? "ui-table-num" : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 3 }).map((_, idx) => (
                <tr key={idx}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      <span className="ui-skeleton-bar" style={{ height: "14px", width: "80%" }} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row, idx) => (
                <tr key={String(row[rowKeyField] ?? idx)}>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={col.numeric ? "ui-table-num" : undefined}
                    >
                      {row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  headerAction,
  children,
  footer,
}: PanelProps) {
  return (
    <section className="ui-panel">
      {(title || subtitle || headerAction) && (
        <header className="ui-panel-header">
          <div>
            {title && <h3 className="ui-panel-title">{title}</h3>}
            {subtitle && <p className="ui-panel-subtitle">{subtitle}</p>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </header>
      )}
      <div className="ui-panel-body">{children}</div>
      {footer && <footer className="ui-panel-footer">{footer}</footer>}
    </section>
  );
}
