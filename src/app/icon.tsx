import { ImageResponse } from "next/og";
import { birdDataUri } from "@/lib/bird-svg";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2A98CC", borderRadius: 14 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={birdDataUri()} width={44} height={50} alt="" />
      </div>
    ),
    size,
  );
}