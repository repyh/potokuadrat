/**
 * A tonal placeholder for the photo grid. The real tiles take their height from
 * each photo's aspect ratio, so the skeleton cycles through representative
 * portrait, landscape, and square ratios instead of one fixed height.
 */
const TILE_RATIOS = [
  "4 / 3",
  "3 / 2",
  "2 / 3",
  "1 / 1",
  "3 / 2",
  "4 / 3",
  "2 / 3",
  "1 / 1",
  "4 / 3",
  "3 / 2",
  "1 / 1",
  "2 / 3",
] as const;

export interface ShareGridSkeletonProps {
  count?: number;
  label?: string;
}

export function ShareGridSkeleton({
  count = TILE_RATIOS.length,
  label = "Loading photographs",
}: ShareGridSkeletonProps) {
  return (
    <div className="share-grid" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="share-tile share-tile-skeleton"
          style={{ aspectRatio: TILE_RATIOS[index % TILE_RATIOS.length] }}
        >
          <span
            className="ui-skeleton-bar"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      ))}
    </div>
  );
}
