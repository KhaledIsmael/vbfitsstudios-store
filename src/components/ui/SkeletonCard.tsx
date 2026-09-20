import React from 'react';

/**
 * Skeleton placeholder matching ProductCard dimensions and typography rhythm.
 * Accepts an index for staggered shimmer animation delays across the grid.
 */
export const ProductCardSkeleton: React.FC<{ variant?: 'featured' | 'grid'; index?: number }> = ({
  variant = 'grid',
  index = 0
}) => {
  const isFeatured = variant === 'featured';
  // Stagger by column position so each card in a row shimmers offset from its neighbour
  const delaySec = (index % 4) * 0.12;

  return (
    <div
      className="block text-left select-none pointer-events-none"
      aria-hidden="true"
    >
      {/* Product Image Skeleton — exact 4:5 aspect ratio matching ProductCard */}
      <div
        className={`w-full skeleton-shimmer relative overflow-hidden ${
          isFeatured ? 'aspect-[3/4] sm:aspect-[4/5]' : 'aspect-[4/5]'
        }`}
        style={{ animationDelay: `${delaySec}s` }}
      >
        {/* "New" tag position placeholder */}
        <div className="absolute top-4 left-4 w-10 h-4 bg-black/[0.04]" />
      </div>

      {/* Product info text skeletons */}
      <div className={`mt-4 sm:mt-6 ${isFeatured ? 'space-y-2.5' : 'space-y-2'}`}>
        {/* Name line */}
        <div
          className={`h-3.5 skeleton-shimmer ${isFeatured ? 'w-4/5' : 'w-3/4'}`}
          style={{ animationDelay: `${delaySec + 0.05}s` }}
        />
        {/* Category/subtitle line */}
        <div
          className="h-2.5 skeleton-shimmer w-1/3"
          style={{ animationDelay: `${delaySec + 0.09}s` }}
        />
        {/* Price line */}
        <div
          className="h-3 skeleton-shimmer w-1/4"
          style={{ animationDelay: `${delaySec + 0.13}s` }}
        />
      </div>
    </div>
  );
};

/**
 * Full grid of ProductCardSkeletons — mirrors the live 4-column catalog grid.
 */
export const ProductGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 sm:gap-x-8 gap-y-12 sm:gap-y-16">
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} variant="grid" index={index} />
      ))}
    </div>
  );
};

/**
 * Skeleton placeholder matching SearchOverlay result cards.
 * Uses 4:5 image block + title/color/price lines.
 */
export const SearchItemSkeleton: React.FC<{ index?: number }> = ({ index = 0 }) => {
  const delaySec = (index % 4) * 0.1;
  return (
    <div
      className="border border-[#EAEAEA] p-3 pointer-events-none select-none"
      aria-hidden="true"
      style={{ animationDelay: `${delaySec}s` }}
    >
      {/* Product image — 4:5 aspect matches live search result cards */}
      <div
        className="aspect-[4/5] skeleton-shimmer mb-3"
        style={{ animationDelay: `${delaySec}s` }}
      />
      {/* Product name */}
      <div
        className="h-3 skeleton-shimmer w-3/4 mb-2"
        style={{ animationDelay: `${delaySec + 0.05}s` }}
      />
      {/* Color */}
      <div
        className="h-2.5 skeleton-shimmer w-2/5 mb-2"
        style={{ animationDelay: `${delaySec + 0.08}s` }}
      />
      {/* Price */}
      <div
        className="h-3 skeleton-shimmer w-1/3 mt-2"
        style={{ animationDelay: `${delaySec + 0.11}s` }}
      />
    </div>
  );
};

/**
 * Grid of SearchItemSkeletons — mirrors SearchOverlay's 4-column results grid.
 */
export const SearchGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
      {Array.from({ length: count }).map((_, index) => (
        <SearchItemSkeleton key={index} index={index} />
      ))}
    </div>
  );
};

/**
 * Skeleton placeholder matching CartDrawer line items.
 * Thumbnail: exactly 80×96px. Rows match live CartDrawer item typography.
 */
export const CartItemSkeleton: React.FC<{ index?: number }> = ({ index = 0 }) => {
  const delaySec = index * 0.08;
  return (
    <div
      className="py-5 flex gap-4 pointer-events-none select-none border-b border-[#EAEAEA] last:border-b-0"
      aria-hidden="true"
    >
      {/* Thumbnail — exactly 80×96px matching CartDrawer item image container */}
      <div
        className="w-20 h-24 skeleton-shimmer flex-shrink-0"
        style={{ animationDelay: `${delaySec}s` }}
      />

      {/* Detail column */}
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          {/* Title + Remove button row */}
          <div className="flex justify-between items-start gap-2">
            <div
              className="h-3.5 skeleton-shimmer w-3/5"
              style={{ animationDelay: `${delaySec + 0.04}s` }}
            />
            <div
              className="h-3 skeleton-shimmer w-10"
              style={{ animationDelay: `${delaySec + 0.04}s` }}
            />
          </div>
          {/* Size label */}
          <div
            className="h-2.5 skeleton-shimmer w-1/3"
            style={{ animationDelay: `${delaySec + 0.07}s` }}
          />
          {/* Price */}
          <div
            className="h-3 skeleton-shimmer w-1/4"
            style={{ animationDelay: `${delaySec + 0.10}s` }}
          />
        </div>

        {/* Quantity stepper outline placeholder */}
        <div className="pt-2">
          <div
            className="h-7 w-20 skeleton-shimmer border border-[#EAEAEA]/50"
            style={{ animationDelay: `${delaySec + 0.13}s` }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Stacked CartItemSkeletons for CartDrawer in-flight state.
 */
export const CartDrawerSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div>
      {Array.from({ length: count }).map((_, index) => (
        <CartItemSkeleton key={index} index={index} />
      ))}
    </div>
  );
};
