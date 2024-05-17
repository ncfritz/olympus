"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListMetadataFetchJobsResponse = exports.GetMetadataFetchJobStatusStatisticsResponse = exports.UpdateMetadataFetchJobResponse = exports.UpdateMetadataFetchJobRequest = exports.DeleteMetadataFetchJobResponse = exports.DescribeMetadataFetchJobResponse = exports.CreateMetadataFetchJobResponse = exports.CreateMetadataFetchJobRequest = exports.PartialMetadataFetchJob = exports.MetadataFetchJob = exports.MetadataJobType = exports.MetadataFetchJobStatus = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var moment_1 = tslib_1.__importDefault(require("moment"));
var ModelCommon_1 = require("../ModelCommon");
var MetadataFetchJobStatus;
(function (MetadataFetchJobStatus) {
    MetadataFetchJobStatus["QUEUED"] = "queued";
    MetadataFetchJobStatus["INVALIDATED"] = "invalidated";
    MetadataFetchJobStatus["FETCHING"] = "fetching";
    MetadataFetchJobStatus["CANCELLED"] = "cancelled";
    MetadataFetchJobStatus["FETCHED"] = "fetched";
    MetadataFetchJobStatus["FAILED"] = "failed";
    MetadataFetchJobStatus["NOT_FOUND"] = "not_found";
})(MetadataFetchJobStatus || (exports.MetadataFetchJobStatus = MetadataFetchJobStatus = {}));
var MetadataJobType;
(function (MetadataJobType) {
    MetadataJobType["MOVIES"] = "movies";
    MetadataJobType["TV_SERIES"] = "tv_series";
    MetadataJobType["TV_SEASONS"] = "tv_seasons";
    MetadataJobType["TV_EPISODES"] = "tv_episodes";
    MetadataJobType["PEOPLE"] = "people";
    MetadataJobType["COLLECTIONS"] = "collections";
    MetadataJobType["TV_NETWORKS"] = "tv_networks";
    MetadataJobType["KEYWORDS"] = "keywords";
    MetadataJobType["PRODUCTION_COMPANIES"] = "production_companies";
    MetadataJobType["CERTIFICATIONS"] = "certifications";
    MetadataJobType["GENRES"] = "genres";
    MetadataJobType["COUNTRIES"] = "countries";
    MetadataJobType["LANGUAGES"] = "languages";
})(MetadataJobType || (exports.MetadataJobType = MetadataJobType = {}));
var MetadataFetchJob = /** @class */ (function () {
    function MetadataFetchJob() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MetadataFetchJob.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: MetadataJobType })
    ], MetadataFetchJob.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: MetadataFetchJobStatus })
    ], MetadataFetchJob.prototype, "status", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MetadataFetchJob.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MetadataFetchJob.prototype, "lastUpdatedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MetadataFetchJob.prototype, "lastFetchedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], MetadataFetchJob.prototype, "ttl", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], MetadataFetchJob.prototype, "jitter", void 0);
    return MetadataFetchJob;
}());
exports.MetadataFetchJob = MetadataFetchJob;
var PartialMetadataFetchJob = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMetadataFetchJob, _super);
    function PartialMetadataFetchJob() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialMetadataFetchJob;
}((0, swagger_1.OmitType)(MetadataFetchJob, [
    "id",
    "type",
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialMetadataFetchJob = PartialMetadataFetchJob;
var CreateMetadataFetchJobRequest = /** @class */ (function () {
    function CreateMetadataFetchJobRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: Number,
            description: "The id of the TMDB entity to create a job for",
            required: true,
        })
    ], CreateMetadataFetchJobRequest.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            enum: MetadataJobType,
            description: "The type of metadata fetch job to create",
            required: true,
        })
    ], CreateMetadataFetchJobRequest.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: Number,
            description: "The number of days until the record expires",
            required: false,
        })
    ], CreateMetadataFetchJobRequest.prototype, "ttl", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: Number,
            description: "The number of minutes to jitter the expirations",
            required: false,
        })
    ], CreateMetadataFetchJobRequest.prototype, "jitter", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            enum: MetadataFetchJobStatus,
            description: "The initial status of the job",
            required: false,
            default: MetadataFetchJobStatus.QUEUED,
        })
    ], CreateMetadataFetchJobRequest.prototype, "status", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String, required: false, default: undefined }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return (value ? (0, moment_1.default)(value) : undefined);
        })
    ], CreateMetadataFetchJobRequest.prototype, "lastFetchedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: Boolean,
            required: false,
            default: true,
        })
    ], CreateMetadataFetchJobRequest.prototype, "publishNotification", void 0);
    return CreateMetadataFetchJobRequest;
}());
exports.CreateMetadataFetchJobRequest = CreateMetadataFetchJobRequest;
var CreateMetadataFetchJobResponse = /** @class */ (function () {
    function CreateMetadataFetchJobResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MetadataFetchJob; },
        })
    ], CreateMetadataFetchJobResponse.prototype, "job", void 0);
    return CreateMetadataFetchJobResponse;
}());
exports.CreateMetadataFetchJobResponse = CreateMetadataFetchJobResponse;
var DescribeMetadataFetchJobResponse = /** @class */ (function () {
    function DescribeMetadataFetchJobResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MetadataFetchJob; },
        })
    ], DescribeMetadataFetchJobResponse.prototype, "job", void 0);
    return DescribeMetadataFetchJobResponse;
}());
exports.DescribeMetadataFetchJobResponse = DescribeMetadataFetchJobResponse;
var DeleteMetadataFetchJobResponse = /** @class */ (function () {
    function DeleteMetadataFetchJobResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MetadataFetchJob; },
        })
    ], DeleteMetadataFetchJobResponse.prototype, "job", void 0);
    return DeleteMetadataFetchJobResponse;
}());
exports.DeleteMetadataFetchJobResponse = DeleteMetadataFetchJobResponse;
var UpdateMetadataFetchJobRequest = /** @class */ (function () {
    function UpdateMetadataFetchJobRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMetadataFetchJob; },
        })
    ], UpdateMetadataFetchJobRequest.prototype, "job", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: Boolean,
            required: false,
            default: true,
        })
    ], UpdateMetadataFetchJobRequest.prototype, "publishNotification", void 0);
    return UpdateMetadataFetchJobRequest;
}());
exports.UpdateMetadataFetchJobRequest = UpdateMetadataFetchJobRequest;
var UpdateMetadataFetchJobResponse = /** @class */ (function () {
    function UpdateMetadataFetchJobResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MetadataFetchJob; },
        })
    ], UpdateMetadataFetchJobResponse.prototype, "job", void 0);
    return UpdateMetadataFetchJobResponse;
}());
exports.UpdateMetadataFetchJobResponse = UpdateMetadataFetchJobResponse;
var GetMetadataFetchJobStatusStatisticsResponse = /** @class */ (function () {
    function GetMetadataFetchJobStatusStatisticsResponse() {
    }
    return GetMetadataFetchJobStatusStatisticsResponse;
}());
exports.GetMetadataFetchJobStatusStatisticsResponse = GetMetadataFetchJobStatusStatisticsResponse;
var ListMetadataFetchJobsResponse = /** @class */ (function (_super) {
    tslib_1.__extends(ListMetadataFetchJobsResponse, _super);
    function ListMetadataFetchJobsResponse() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return MetadataFetchJob; }, isArray: true })
    ], ListMetadataFetchJobsResponse.prototype, "jobs", void 0);
    return ListMetadataFetchJobsResponse;
}(ModelCommon_1.PaginatedResults));
exports.ListMetadataFetchJobsResponse = ListMetadataFetchJobsResponse;
//# sourceMappingURL=fetchJob.js.map