import { Breadcrumb } from "antd";
import type { BreadcrumbItemType } from "antd/lib/breadcrumb/Breadcrumb";

export interface OlympusBreadcrumbsProps {
  items: Partial<BreadcrumbItemType>[];
  className?: string;
}

const OlympusBreadcrumbs = ({ items, className }: OlympusBreadcrumbsProps) => {
  const newItems = items.map((item, index) => {
    const classNames = [className, "level", `level-${items.length - index}`];

    if (index === 0) {
      classNames.push("root");
    }

    return { ...item, className: classNames.join(" ") };
  });

  return (
    <Breadcrumb className={"olympus-bc"} items={newItems} separator={""} />
  );
};
export default OlympusBreadcrumbs;
