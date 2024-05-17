"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartialTVSeasonExternalId = exports.TVSeasonExternalId = exports.PartialSeason = exports.Season = exports.BaseSeason = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var tvEpisode_1 = require("./tvEpisode");
var tvSeries_1 = require("./tvSeries");
var BaseSeason = /** @class */ (function () {
    function BaseSeason() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseSeason.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseSeason.prototype, "alternateId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], BaseSeason.prototype, "airDate", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseSeason.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseSeason.prototype, "overview", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseSeason.prototype, "posterPath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseSeason.prototype, "seasonNumber", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return tvSeries_1.TVSeriesVideo; },
        })
    ], BaseSeason.prototype, "series", void 0);
    return BaseSeason;
}());
exports.BaseSeason = BaseSeason;
var Season = /** @class */ (function (_super) {
    tslib_1.__extends(Season, _super);
    function Season() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Season.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Season.prototype, "lastUpdatedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeasonExternalId; },
            isArray: true,
        })
    ], Season.prototype, "externalIds", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return tvEpisode_1.Episode; },
            isArray: true,
        })
    ], Season.prototype, "episodes", void 0);
    return Season;
}(BaseSeason));
exports.Season = Season;
var PartialSeason = /** @class */ (function (_super) {
    tslib_1.__extends(PartialSeason, _super);
    function PartialSeason() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeasonExternalId; },
            isArray: true,
        })
    ], PartialSeason.prototype, "externalIds", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return tvEpisode_1.PartialEpisode; },
            isArray: true,
        })
    ], PartialSeason.prototype, "episodes", void 0);
    return PartialSeason;
}(BaseSeason));
exports.PartialSeason = PartialSeason;
var TVSeasonExternalId = /** @class */ (function () {
    function TVSeasonExternalId() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeasonExternalId.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeasonExternalId.prototype, "externalId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeasonExternalId.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeasonExternalId.prototype, "lastUpdatedTime", void 0);
    return TVSeasonExternalId;
}());
exports.TVSeasonExternalId = TVSeasonExternalId;
var PartialTVSeasonExternalId = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeasonExternalId, _super);
    function PartialTVSeasonExternalId() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialTVSeasonExternalId;
}((0, swagger_1.OmitType)(TVSeasonExternalId, [
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialTVSeasonExternalId = PartialTVSeasonExternalId;
//# sourceMappingURL=tvSeason.js.map