import "katex/dist/katex.min.css";

export const metadata = {
  title: "Robert",
  description: "Your personal AI assistant",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
  }
