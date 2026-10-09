export interface RotatedTableHeaderProps {
  children: React.ReactNode;
  width?: number;
  height?: number;
  align?: "left" | "center" | "right";
}

const RotatedTableHeader: React.FunctionComponent<RotatedTableHeaderProps> = ({
  width = 60,
  height = 78,
  align = "center",
  children,
}: RotatedTableHeaderProps) => {
  let rightPercent = "50%";

  if (align === "left") {
    rightPercent = "100%";
  } else if (align === "right") {
    rightPercent = "0%";
  }

  return (
    <th
      style={{
        padding: "8px 16px 0px 16px",
        textAlign: "left",
        width: width,
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <div
        style={{
          position: "relative",
          height: height,
        }}
      >
        <span
          style={{
            position: "absolute",
            transform: "rotate(45deg)",
            transformOrigin: "center right",
            whiteSpace: "nowrap",
            bottom: 0,
            right: rightPercent,
          }}
        >
          {children}
        </span>
      </div>
    </th>
  );
};
export default RotatedTableHeader;
