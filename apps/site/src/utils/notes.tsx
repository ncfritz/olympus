import {
  DeploymentUnitOutlined,
  FileOutlined,
  LikeFilled,
  QuestionCircleOutlined,
  WarningFilled,
} from "@ant-design/icons";
import { PredictiveAnalysisIcon } from "../icons";

export interface NoteAssociation {
  itemId: string;
  itemType: string;
  createdTime: string;
}

export const config: Record<number, Record<string, any>> = {
  0: {
    type: "note",
    label: "Note",
    icon: <FileOutlined />,
    color: "#32485c",
    secondaryColor: "#d3e3f1",
  },
  1: {
    type: "idea",
    label: "Idea",
    icon: <PredictiveAnalysisIcon />,
    color: "#67598c",
    secondaryColor: "#d6ceeb",
  },
  2: {
    type: "thought",
    label: "Thought",
    icon: <DeploymentUnitOutlined />,
    color: "#c05a91",
    secondaryColor: "#f7dbea",
  },
  3: {
    type: "alert",
    label: "Alert",
    icon: <WarningFilled />,
    color: "#df5b84",
    secondaryColor: "#f7dbea",
  },
  4: {
    type: "praise",
    label: "Praise",
    icon: <LikeFilled />,
    color: "#ff7356",
    secondaryColor: "#fbdbd4",
  },
  5: {
    type: "question",
    label: "Question",
    icon: <QuestionCircleOutlined />,
    color: "#ffa600",
    secondaryColor: "#ffedcb",
  },
};

export const getIconForType = (type: number) => {
  return config[type].icon;
};

export const getColorForType = (type: number) => {
  return config[type].color;
};

export const getSecondaryColorForType = (type: number) => {
  return config[type].secondaryColor;
};
