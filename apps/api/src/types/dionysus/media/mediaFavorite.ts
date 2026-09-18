import { GraphQlMediaAssetWorkflowDecoration } from "./mediaAssetWorkflow";

export type GraphQlSparseMediaFavorite = {
  createdTime: string;
};

export type GraphQlMediaFavorite = GraphQlSparseMediaFavorite & {
  decoration: GraphQlMediaAssetWorkflowDecoration;
};
