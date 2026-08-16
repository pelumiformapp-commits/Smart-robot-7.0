import "katex/dist/katex.min.css";

export const metadata = {
  title: "Robert",
  description: "Your personal AI assistant",
  manifest: "/manifest.json",
  themeColor: "#5e81ac",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Robert",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
