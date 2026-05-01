export function StandaloneBox({ data }: { data: { width: number; height: number } }) {
  return (
    <div
      style={{
        width: data.width,
        height: data.height,
        border: "1px dashed #334155",
        borderRadius: 12,
        background: "rgba(30, 41, 59, 0.2)",
        position: "relative",
        pointerEvents: "none",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -11,
          left: 20,
          background: "#0f172a",
          padding: "0 10px",
          fontSize: 10,
          fontWeight: 700,
          color: "#475569",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          lineHeight: "22px",
          userSelect: "none",
        }}
      >
        Standalone Tasks
      </div>
    </div>
  );
}
