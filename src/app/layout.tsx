import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/nunito"; // rounded, friendly font, served locally
import { MascotProvider } from "@/components/mascot/MascotProvider";

export const metadata: Metadata = {
  title: "Edu Hub",
  description: "Daily quizzes and study practice",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MascotProvider>{children}</MascotProvider>
      </body>
    </html>
  );
}