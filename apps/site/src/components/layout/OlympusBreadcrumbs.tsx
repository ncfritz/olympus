import { Breadcrumb } from "antd";
import type { BreadcrumbItemType } from "antd/lib/breadcrumb/Breadcrumb";
import { useAppSelector } from "../../redux/hooks";

export interface OlympusBreadcrumbsProps {
  items: Partial<BreadcrumbItemType>[];
  className?: string;
}

const COLORS_DARK = [
  ["#001529"],
  ["#324354", "#001529"],
  ["#324354", "#192b3e", "#001529"],
  ["#324354", "#213345", "#112437", "#001529"],
  ["#324354", "#263749", "#192b3e", "#0d2033", "#001529"],
  ["#324354", "#28394b", "#1e3042", "#14273a", "#0a1e31", "#001529"],
  ["#324354", "#2a3b4d", "#213345", "#192b3e", "#112437", "#081c30", "#001529"],
  [
    "#324354",
    "#2b3c4e",
    "#243547",
    "#1d2e41",
    "#16283b",
    "#0f2135",
    "#071b2f",
    "#001529",
  ],
  [
    "#324354",
    "#2c3d4e",
    "#263749",
    "#1f3143",
    "#192b3e",
    "#132539",
    "#0d2033",
    "#061a2e",
    "#001529",
  ],
  [
    "#324354",
    "#2c3e4f",
    "#27384a",
    "#213345",
    "#1c2e40",
    "#17293c",
    "#112437",
    "#0b1f32",
    "#061a2e",
    "#001529",
  ],
  [
    "#324354",
    "#2d3e50",
    "#28394b",
    "#233547",
    "#1e3042",
    "#192b3e",
    "#14273a",
    "#0f2235",
    "#0a1e31",
    "#05192d",
    "#001529",
  ],
];

const OlympusBreadcrumbs = ({ items, className }: OlympusBreadcrumbsProps) => {
  const submenuExpanded = useAppSelector(
    (state) => state.layout.submenuExpanded,
  );

  const baseClassNames = ["olympus-bc", `items-${items.length}`, className];
  const newItems = items.map((item, index) => {
    const classNames = ["level", `level-${items.length - index}`];

    if (index === 0) {
      classNames.push("root");
    }

    return { ...item, className: classNames.join(" ") };
  });

  return (
    <Breadcrumb
      className={baseClassNames.join(" ")}
      items={newItems}
      separator={""}
      style={{
        position: "fixed",
        left: 80,
        width: `calc(100vw - ${submenuExpanded ? 300 : 80})`,
        zIndex: 400,
      }}
    />
  );
};
export default OlympusBreadcrumbs;
