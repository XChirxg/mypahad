'use client';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#f0f0ee] pb-8 font-sans">
      {/* Skeleton Navbar */}
      <div className="bg-[#1a5c3a] h-12 w-full flex items-center justify-between px-3.5 sticky top-0 z-50">
        <div className="w-24 h-4 bg-white/20 rounded animate-pulse" />
        <div className="flex gap-3">
          <div className="w-5 h-5 rounded-full bg-white/20 animate-pulse" />
          <div className="w-5 h-5 rounded-full bg-white/20 animate-pulse" />
        </div>
      </div>

      {/* Skeleton search input */}
      <div className="p-2 px-2.5 bg-white border-b border-[#ddd]">
        <div className="h-9 bg-gray-100 rounded border border-[#ddd] animate-pulse" />
      </div>

      {/* Main Skeleton Grid */}
      <div className="max-w-[1200px] mx-auto p-3.5 flex flex-col gap-4">
        {/* Category horizontal scrolling simulation */}
        <div className="flex gap-2 overflow-hidden py-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-16 h-6 rounded-full bg-white border border-gray-200 shrink-0 animate-pulse" />
          ))}
        </div>

        {/* Banner ad skeleton */}
        <div className="w-full h-24 bg-white rounded-lg border border-gray-200 animate-pulse" />

        {/* Product Grid */}
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="bg-white rounded border border-[#ddd] overflow-hidden flex flex-col justify-between p-1.5 h-36 animate-pulse">
              <div className="w-full aspect-square bg-gray-100 rounded" />
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="h-3 bg-gray-100 rounded w-5/6" />
                <div className="h-2 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
