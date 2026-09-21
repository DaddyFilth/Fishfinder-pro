export default function BrandMark() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        minWidth: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{ fontSize: "18px", flexShrink: 0, lineHeight: 1 }}
      >
        🎣
      </span>
      <h1
        style={{
          fontSize: "14px",
          fontWeight: 800,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          margin: 0,
          background: "linear-gradient(90deg,#22d3ee,#0ea5e9)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Oklahoma SeamCast
      </h1>
    </div>
  );
}
