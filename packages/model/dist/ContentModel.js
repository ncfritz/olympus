"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateContentAssetTagResponse = exports.CreateContentAssetTagRequest = exports.CreateContentJobRequest = exports.ContentAggregateStatisticsResponse = exports.ContentStatisticsResponse = exports.ContentStatisticsSeries = exports.ContentAssetTag = exports.BaseContentAssetTag = exports.ContentAsset = exports.BaseContentAsset = exports.RemoveContentAssetTagFromAsset = exports.GetContentAssetWithStatsResponse = exports.GetContentAssetResponse = exports.AddContentAssetTagToAssetRequest = exports.ListContentAssetTagsForAssetResponse = exports.ListAvailableContentAssetTagsResponse = exports.SetContentAssetRatingRequest = exports.ListDuplicateContentAssetsResponse = exports.ListSimilarContentAssetsResponse = exports.ListContentAssetsResponse = exports.CreateContentAssetResponse = exports.CreateContentAssetRequest = exports.ContentJobType = exports.ContentTagType = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var ModelCommon_1 = require("./ModelCommon");
var ContentTagType;
(function (ContentTagType) {
    ContentTagType["SOURCE"] = "source";
    ContentTagType["USER"] = "user";
    ContentTagType["TYPE"] = "type";
    ContentTagType["SYSTEM"] = "system";
})(ContentTagType || (exports.ContentTagType = ContentTagType = {}));
var ContentJobType;
(function (ContentJobType) {
    ContentJobType["HLS"] = "hls";
    ContentJobType["THUMBNAIL"] = "thumbnail";
    ContentJobType["DELETE"] = "delete";
})(ContentJobType || (exports.ContentJobType = ContentJobType = {}));
var CreateContentAssetRequest = /** @class */ (function () {
    function CreateContentAssetRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return BaseContentAsset; },
        })
    ], CreateContentAssetRequest.prototype, "asset", void 0);
    return CreateContentAssetRequest;
}());
exports.CreateContentAssetRequest = CreateContentAssetRequest;
var CreateContentAssetResponse = /** @class */ (function () {
    function CreateContentAssetResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return ContentAsset; },
        })
    ], CreateContentAssetResponse.prototype, "asset", void 0);
    return CreateContentAssetResponse;
}());
exports.CreateContentAssetResponse = CreateContentAssetResponse;
var ListContentAssetsResponse = /** @class */ (function (_super) {
    tslib_1.__extends(ListContentAssetsResponse, _super);
    function ListContentAssetsResponse() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return ContentAsset; }, isArray: true })
    ], ListContentAssetsResponse.prototype, "assets", void 0);
    return ListContentAssetsResponse;
}(ModelCommon_1.PaginatedResults));
exports.ListContentAssetsResponse = ListContentAssetsResponse;
var ListSimilarContentAssetsResponse = /** @class */ (function () {
    function ListSimilarContentAssetsResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return ContentAsset; }, isArray: true })
    ], ListSimilarContentAssetsResponse.prototype, "assets", void 0);
    return ListSimilarContentAssetsResponse;
}());
exports.ListSimilarContentAssetsResponse = ListSimilarContentAssetsResponse;
var ListDuplicateContentAssetsResponse = /** @class */ (function () {
    function ListDuplicateContentAssetsResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return ContentAsset; }, isArray: true })
    ], ListDuplicateContentAssetsResponse.prototype, "assets", void 0);
    return ListDuplicateContentAssetsResponse;
}());
exports.ListDuplicateContentAssetsResponse = ListDuplicateContentAssetsResponse;
var SetContentAssetRatingRequest = /** @class */ (function () {
    function SetContentAssetRatingRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], SetContentAssetRatingRequest.prototype, "rating", void 0);
    return SetContentAssetRatingRequest;
}());
exports.SetContentAssetRatingRequest = SetContentAssetRatingRequest;
var ListAvailableContentAssetTagsResponse = /** @class */ (function () {
    function ListAvailableContentAssetTagsResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return ContentAssetTag; }, isArray: true })
    ], ListAvailableContentAssetTagsResponse.prototype, "tags", void 0);
    return ListAvailableContentAssetTagsResponse;
}());
exports.ListAvailableContentAssetTagsResponse = ListAvailableContentAssetTagsResponse;
var ListContentAssetTagsForAssetResponse = /** @class */ (function () {
    function ListContentAssetTagsForAssetResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return ContentAssetTag; }, isArray: true })
    ], ListContentAssetTagsForAssetResponse.prototype, "tags", void 0);
    return ListContentAssetTagsForAssetResponse;
}());
exports.ListContentAssetTagsForAssetResponse = ListContentAssetTagsForAssetResponse;
var AddContentAssetTagToAssetRequest = /** @class */ (function () {
    function AddContentAssetTagToAssetRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return BaseContentAssetTag; } })
    ], AddContentAssetTagToAssetRequest.prototype, "tag", void 0);
    return AddContentAssetTagToAssetRequest;
}());
exports.AddContentAssetTagToAssetRequest = AddContentAssetTagToAssetRequest;
var GetContentAssetResponse = /** @class */ (function () {
    function GetContentAssetResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return ContentAsset; } })
    ], GetContentAssetResponse.prototype, "asset", void 0);
    return GetContentAssetResponse;
}());
exports.GetContentAssetResponse = GetContentAssetResponse;
var GetContentAssetWithStatsResponse = /** @class */ (function () {
    function GetContentAssetWithStatsResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return ContentAsset; } })
    ], GetContentAssetWithStatsResponse.prototype, "asset", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], GetContentAssetWithStatsResponse.prototype, "tagged", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], GetContentAssetWithStatsResponse.prototype, "untagged", void 0);
    return GetContentAssetWithStatsResponse;
}());
exports.GetContentAssetWithStatsResponse = GetContentAssetWithStatsResponse;
var RemoveContentAssetTagFromAsset = /** @class */ (function () {
    function RemoveContentAssetTagFromAsset() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], RemoveContentAssetTagFromAsset.prototype, "contentAssetTagId", void 0);
    return RemoveContentAssetTagFromAsset;
}());
exports.RemoveContentAssetTagFromAsset = RemoveContentAssetTagFromAsset;
var BaseContentAsset = /** @class */ (function () {
    function BaseContentAsset() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseContentAsset.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseContentAsset.prototype, "originalName", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseContentAsset.prototype, "originalSha", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseContentAsset.prototype, "originalSizeBytes", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseContentAsset.prototype, "newSha", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseContentAsset.prototype, "newSizeBytes", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseContentAsset.prototype, "durationMs", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseContentAsset.prototype, "width", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseContentAsset.prototype, "height", void 0);
    return BaseContentAsset;
}());
exports.BaseContentAsset = BaseContentAsset;
var ContentAsset = /** @class */ (function (_super) {
    tslib_1.__extends(ContentAsset, _super);
    function ContentAsset() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], ContentAsset.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], ContentAsset.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ContentAsset.prototype, "rating", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return ContentAssetTag; }, isArray: true })
    ], ContentAsset.prototype, "tags", void 0);
    return ContentAsset;
}(BaseContentAsset));
exports.ContentAsset = ContentAsset;
var BaseContentAssetTag = /** @class */ (function () {
    function BaseContentAssetTag() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseContentAssetTag.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: ContentTagType })
    ], BaseContentAssetTag.prototype, "type", void 0);
    return BaseContentAssetTag;
}());
exports.BaseContentAssetTag = BaseContentAssetTag;
var ContentAssetTag = /** @class */ (function (_super) {
    tslib_1.__extends(ContentAssetTag, _super);
    function ContentAssetTag() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], ContentAssetTag.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], ContentAssetTag.prototype, "createdTime", void 0);
    return ContentAssetTag;
}(BaseContentAssetTag));
exports.ContentAssetTag = ContentAssetTag;
var ContentStatisticsSeries = /** @class */ (function () {
    function ContentStatisticsSeries() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], ContentStatisticsSeries.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return Number; }, isArray: true })
    ], ContentStatisticsSeries.prototype, "data", void 0);
    return ContentStatisticsSeries;
}());
exports.ContentStatisticsSeries = ContentStatisticsSeries;
var ContentStatisticsResponse = /** @class */ (function () {
    function ContentStatisticsResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return String; }, isArray: true })
    ], ContentStatisticsResponse.prototype, "categories", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return ContentStatisticsSeries; }, isArray: true })
    ], ContentStatisticsResponse.prototype, "series", void 0);
    return ContentStatisticsResponse;
}());
exports.ContentStatisticsResponse = ContentStatisticsResponse;
var ContentAggregateStatisticsResponse = /** @class */ (function () {
    function ContentAggregateStatisticsResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ContentAggregateStatisticsResponse.prototype, "count", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ContentAggregateStatisticsResponse.prototype, "minSize", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ContentAggregateStatisticsResponse.prototype, "maxSize", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ContentAggregateStatisticsResponse.prototype, "avgSize", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ContentAggregateStatisticsResponse.prototype, "totalSize", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ContentAggregateStatisticsResponse.prototype, "minDuration", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ContentAggregateStatisticsResponse.prototype, "maxDuration", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ContentAggregateStatisticsResponse.prototype, "avgDuration", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ContentAggregateStatisticsResponse.prototype, "totalDuration", void 0);
    return ContentAggregateStatisticsResponse;
}());
exports.ContentAggregateStatisticsResponse = ContentAggregateStatisticsResponse;
var CreateContentJobRequest = /** @class */ (function () {
    function CreateContentJobRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            enum: ContentJobType,
            description: "The type of content job to create",
            required: true,
        })
    ], CreateContentJobRequest.prototype, "type", void 0);
    return CreateContentJobRequest;
}());
exports.CreateContentJobRequest = CreateContentJobRequest;
var CreateContentAssetTagRequest = /** @class */ (function () {
    function CreateContentAssetTagRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return BaseContentAssetTag; } })
    ], CreateContentAssetTagRequest.prototype, "tag", void 0);
    return CreateContentAssetTagRequest;
}());
exports.CreateContentAssetTagRequest = CreateContentAssetTagRequest;
var CreateContentAssetTagResponse = /** @class */ (function () {
    function CreateContentAssetTagResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return ContentAssetTag; } })
    ], CreateContentAssetTagResponse.prototype, "tag", void 0);
    return CreateContentAssetTagResponse;
}());
exports.CreateContentAssetTagResponse = CreateContentAssetTagResponse;
//# sourceMappingURL=ContentModel.js.map