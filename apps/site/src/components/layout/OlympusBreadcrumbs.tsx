import { Breadcrumb } from "antd";
import type { BreadcrumbItemType } from "antd/lib/breadcrumb/Breadcrumb";
import { useAppSelector } from "../../redux/hooks";

export interface OlympusBreadcrumbsProps {
  items: Partial<BreadcrumbItemType>[];
  className?: string;
}

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
