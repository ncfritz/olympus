import { GraphQlMediaAssetWorkflowDecoration } from "../../workflows/types/mediaAssetWorkflow";

export type GraphQlSparseMediaFavorite = {
  createdTime: string;
};

export type GraphQlMediaFavorite = GraphQlSparseMediaFavorite & {
  decoration: GraphQlMediaAssetWorkflowDecoration;
};
