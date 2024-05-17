"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchJobStats = exports.PartialBatchJob = exports.BatchJob = exports.UpdateBatchJobResponse = exports.UpdateBatchJobRequest = exports.ListBatchJobsByTypeResponse = exports.ListBatchJobsResponse = exports.GetBatchJobStatsByTypeResponse = exports.GetBatchJobStatsResponse = exports.GetBatchJobLogsResponse = exports.DescribeBatchJobResponse = exports.DeleteBatchJobResponse = exports.CreateBatchJobResponse = exports.CreateBatchJobRequest = exports.JobStatus = exports.JobType = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var index_1 = require("./index");
var JobType;
(function (JobType) {
    JobType["MOVIES"] = "movies";
    JobType["TV_SERIES"] = "tv_series";
    JobType["PEOPLE"] = "people";
    JobType["COLLECTIONS"] = "collections";
    JobType["TV_NETWORKS"] = "tv_networks";
    JobType["KEYWORDS"] = "keywords";
    JobType["PRODUCTION_COMPANIES"] = "production_companies";
    JobType["CERTIFICATIONS"] = "certifications";
    JobType["GENRES"] = "genres";
    JobType["COUNTRIES"] = "countries";
    JobType["LANGUAGES"] = "languages";
})(JobType || (exports.JobType = JobType = {}));
var JobStatus;
(function (JobStatus) {
    JobStatus["CREATED"] = "created";
    JobStatus["STARTED"] = "started";
    JobStatus["CANCELLED"] = "cancelled";
    JobStatus["SUCCESS"] = "success";
    JobStatus["FAILED"] = "failed";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
var CreateBatchJobRequest = /** @class */ (function () {
    function CreateBatchJobRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            enum: JobType,
            description: "The type of batch job to create",
            required: true,
        })
    ], CreateBatchJobRequest.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: Boolean,
            description: "Defaults to true, set to false to prevent publishing an AMQP message",
            required: false,
            default: true,
        })
    ], CreateBatchJobRequest.prototype, "publishNotification", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: Number,
            description: "Which record to start processing from",
            required: false,
            default: 0,
        })
    ], CreateBatchJobRequest.prototype, "offset", void 0);
    return CreateBatchJobRequest;
}());
exports.CreateBatchJobRequest = CreateBatchJobRequest;
var CreateBatchJobResponse = /** @class */ (function () {
    function CreateBatchJobResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return BatchJob; },
        })
    ], CreateBatchJobResponse.prototype, "job", void 0);
    return CreateBatchJobResponse;
}());
exports.CreateBatchJobResponse = CreateBatchJobResponse;
var DeleteBatchJobResponse = /** @class */ (function () {
    function DeleteBatchJobResponse() {
    }
    return DeleteBatchJobResponse;
}());
exports.DeleteBatchJobResponse = DeleteBatchJobResponse;
var DescribeBatchJobResponse = /** @class */ (function () {
    function DescribeBatchJobResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return BatchJob; },
        })
    ], DescribeBatchJobResponse.prototype, "job", void 0);
    return DescribeBatchJobResponse;
}());
exports.DescribeBatchJobResponse = DescribeBatchJobResponse;
var GetBatchJobLogsResponse = /** @class */ (function () {
    function GetBatchJobLogsResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], GetBatchJobLogsResponse.prototype, "jobId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], GetBatchJobLogsResponse.prototype, "lastEventTimestamp", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return index_1.LogLine; }, isArray: true })
    ], GetBatchJobLogsResponse.prototype, "logs", void 0);
    return GetBatchJobLogsResponse;
}());
exports.GetBatchJobLogsResponse = GetBatchJobLogsResponse;
var GetBatchJobStatsResponse = /** @class */ (function () {
    function GetBatchJobStatsResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: Object,
            additionalProperties: { type: "BatchJobStats" },
        })
    ], GetBatchJobStatsResponse.prototype, "categories", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: Object,
            additionalProperties: { type: "BatchJobStats" },
        })
    ], GetBatchJobStatsResponse.prototype, "series", void 0);
    return GetBatchJobStatsResponse;
}());
exports.GetBatchJobStatsResponse = GetBatchJobStatsResponse;
var GetBatchJobStatsByTypeResponse = /** @class */ (function () {
    function GetBatchJobStatsByTypeResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: Object,
            additionalProperties: { type: "BatchJobStats" },
        })
    ], GetBatchJobStatsByTypeResponse.prototype, "series", void 0);
    return GetBatchJobStatsByTypeResponse;
}());
exports.GetBatchJobStatsByTypeResponse = GetBatchJobStatsByTypeResponse;
var ListBatchJobsResponse = /** @class */ (function () {
    function ListBatchJobsResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return BatchJob; }, isArray: true })
    ], ListBatchJobsResponse.prototype, "jobs", void 0);
    return ListBatchJobsResponse;
}());
exports.ListBatchJobsResponse = ListBatchJobsResponse;
var ListBatchJobsByTypeResponse = /** @class */ (function () {
    function ListBatchJobsByTypeResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return BatchJob; }, isArray: true })
    ], ListBatchJobsByTypeResponse.prototype, "jobs", void 0);
    return ListBatchJobsByTypeResponse;
}());
exports.ListBatchJobsByTypeResponse = ListBatchJobsByTypeResponse;
var UpdateBatchJobRequest = /** @class */ (function () {
    function UpdateBatchJobRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialBatchJob; },
        })
    ], UpdateBatchJobRequest.prototype, "job", void 0);
    return UpdateBatchJobRequest;
}());
exports.UpdateBatchJobRequest = UpdateBatchJobRequest;
var UpdateBatchJobResponse = /** @class */ (function () {
    function UpdateBatchJobResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return BatchJob; },
        })
    ], UpdateBatchJobResponse.prototype, "job", void 0);
    return UpdateBatchJobResponse;
}());
exports.UpdateBatchJobResponse = UpdateBatchJobResponse;
var BatchJob = /** @class */ (function () {
    function BatchJob() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BatchJob.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: JobType })
    ], BatchJob.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: JobStatus })
    ], BatchJob.prototype, "status", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], BatchJob.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], BatchJob.prototype, "lastUpdatedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return (value ? value.toISOString() : undefined);
        })
    ], BatchJob.prototype, "startedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return (value ? value.toISOString() : undefined);
        })
    ], BatchJob.prototype, "finishedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BatchJob.prototype, "totalRecords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BatchJob.prototype, "skippedRecords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BatchJob.prototype, "processedRecords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BatchJob.prototype, "duplicateRecords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BatchJob.prototype, "noOpRecords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BatchJob.prototype, "newRecords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BatchJob.prototype, "expiredRecords", void 0);
    return BatchJob;
}());
exports.BatchJob = BatchJob;
var PartialBatchJob = /** @class */ (function (_super) {
    tslib_1.__extends(PartialBatchJob, _super);
    function PartialBatchJob() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialBatchJob;
}((0, swagger_1.OmitType)(BatchJob, [
    "id",
    "type",
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialBatchJob = PartialBatchJob;
var BatchJobStats = /** @class */ (function () {
    function BatchJobStats() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: JobStatus })
    ], BatchJobStats.prototype, "status", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BatchJobStats.prototype, "totalRecords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BatchJobStats.prototype, "duplicateRecords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BatchJobStats.prototype, "noOpRecords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BatchJobStats.prototype, "newRecords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BatchJobStats.prototype, "expiredRecords", void 0);
    return BatchJobStats;
}());
exports.BatchJobStats = BatchJobStats;
//# sourceMappingURL=BatchJobModel.js.map