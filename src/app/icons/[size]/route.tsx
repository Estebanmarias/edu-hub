import { ImageResponse } from "next/og";

// App icon drawn by code, so there is no image file to manage. Replace later with a real logo.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "512" ? 512 : 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563eb",
          color: "white",
          fontSize: Math.round(px * 0.42),
          fontWeight: 800,
        }}
      >
        EH
      </div>
    ),
    { width: px, height: px },
  );
}