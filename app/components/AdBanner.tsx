'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

export default function AdBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
      <div className="relative">
        <a
          href="https://shopify.pxf.io/m4OXk1"
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block"
        >
          <img
            src="/ShopifyAddImg.png"
            alt="Try Shopify free"
            className="h-10 md:h-12 w-auto object-contain"
          />
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-0 right-0 bg-gray-800/70 hover:bg-gray-800 text-white rounded-full p-0.5 transition-colors"
          aria-label="Close ad"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
