import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YAAP Admin",
    short_name: "YAAP Admin",
    description: "Conference and mobile app administration",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#18181b",
    icons: [
      {
        src: "/android-chrome-192x192.png?v=66",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png?v=66",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
