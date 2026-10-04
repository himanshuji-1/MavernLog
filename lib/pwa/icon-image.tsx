import { ImageResponse } from "next/og";

/**
 * App icon: dark square, emerald "M". Full-bleed with the letter inside the
 * central safe zone, so the same image works as a maskable icon.
 */
export function renderIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#10b981",
          fontSize: size * 0.56,
          fontWeight: 800,
        }}
      >
        M
      </div>
    ),
    { width: size, height: size },
  );
}
