"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartialTVEpisodeVideo = exports.TVEpisodeVideo = exports.PartialTVEpisodeImage = exports.TVEpisodeImage = exports.PartialTVEpisodeGuestStar = exports.TVEpisodeGuestStar = exports.PartialTVEpisodeExternalId = exports.TVEpisodeExternalId = exports.PartialEpisode = exports.Episode = exports.BaseEpisode = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var countries_1 = require("./countries");
var languages_1 = require("./languages");
var people_1 = require("./people");
var tvSeason_1 = require("./tvSeason");
var tvSeries_1 = require("./tvSeries");
var BaseEpisode = /** @class */ (function () {
    function BaseEpisode() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseEpisode.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: tvSeries_1.TVSeries })
    ], BaseEpisode.prototype, "series", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: tvSeason_1.Season })
    ], BaseEpisode.prototype, "season", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], BaseEpisode.prototype, "airDate", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseEpisode.prototype, "episodeNumber", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseEpisode.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseEpisode.prototype, "overview", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseEpisode.prototype, "productionCode", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseEpisode.prototype, "runtime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseEpisode.prototype, "seasonNumber", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseEpisode.prototype, "stillPath", void 0);
    return BaseEpisode;
}());
exports.BaseEpisode = BaseEpisode;
var Episode = /** @class */ (function (_super) {
    tslib_1.__extends(Episode, _super);
    function Episode() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Episode.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Episode.prototype, "lastUpdatedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVEpisodeExternalId; },
            isArray: true,
        })
    ], Episode.prototype, "externalIds", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVEpisodeGuestStar; },
            isArray: true,
        })
    ], Episode.prototype, "guestStars", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVEpisodeImage; },
            isArray: true,
        })
    ], Episode.prototype, "images", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVEpisodeVideo; },
            isArray: true,
        })
    ], Episode.prototype, "videos", void 0);
    return Episode;
}(BaseEpisode));
exports.Episode = Episode;
var PartialEpisode = /** @class */ (function (_super) {
    tslib_1.__extends(PartialEpisode, _super);
    function PartialEpisode() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVEpisodeExternalId; },
            isArray: true,
        })
    ], PartialEpisode.prototype, "externalIds", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVEpisodeGuestStar; },
            isArray: true,
        })
    ], PartialEpisode.prototype, "guestStars", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVEpisodeImage; },
            isArray: true,
        })
    ], PartialEpisode.prototype, "images", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVEpisodeVideo; },
            isArray: true,
        })
    ], PartialEpisode.prototype, "videos", void 0);
    return PartialEpisode;
}(BaseEpisode));
exports.PartialEpisode = PartialEpisode;
var TVEpisodeExternalId = /** @class */ (function () {
    function TVEpisodeExternalId() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeExternalId.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeExternalId.prototype, "externalId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVEpisodeExternalId.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVEpisodeExternalId.prototype, "lastUpdatedTime", void 0);
    return TVEpisodeExternalId;
}());
exports.TVEpisodeExternalId = TVEpisodeExternalId;
var PartialTVEpisodeExternalId = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVEpisodeExternalId, _super);
    function PartialTVEpisodeExternalId() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialTVEpisodeExternalId;
}((0, swagger_1.OmitType)(TVEpisodeExternalId, [
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialTVEpisodeExternalId = PartialTVEpisodeExternalId;
var TVEpisodeGuestStar = /** @class */ (function () {
    function TVEpisodeGuestStar() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeGuestStar.prototype, "creditId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: people_1.Person })
    ], TVEpisodeGuestStar.prototype, "person", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeGuestStar.prototype, "originalName", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeGuestStar.prototype, "character", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], TVEpisodeGuestStar.prototype, "order", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVEpisodeGuestStar.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVEpisodeGuestStar.prototype, "lastUpdatedTime", void 0);
    return TVEpisodeGuestStar;
}());
exports.TVEpisodeGuestStar = TVEpisodeGuestStar;
var PartialTVEpisodeGuestStar = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVEpisodeGuestStar, _super);
    function PartialTVEpisodeGuestStar() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PartialTVEpisodeGuestStar.prototype, "personId", void 0);
    return PartialTVEpisodeGuestStar;
}((0, swagger_1.OmitType)(TVEpisodeGuestStar, [
    "createdTime",
    "lastUpdatedTime",
    "person",
])));
exports.PartialTVEpisodeGuestStar = PartialTVEpisodeGuestStar;
var TVEpisodeImage = /** @class */ (function () {
    function TVEpisodeImage() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeImage.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeImage.prototype, "filePath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], TVEpisodeImage.prototype, "width", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], TVEpisodeImage.prototype, "height", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], TVEpisodeImage.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVEpisodeImage.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVEpisodeImage.prototype, "lastUpdatedTime", void 0);
    return TVEpisodeImage;
}());
exports.TVEpisodeImage = TVEpisodeImage;
var PartialTVEpisodeImage = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVEpisodeImage, _super);
    function PartialTVEpisodeImage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialTVEpisodeImage.prototype, "countryCode", void 0);
    return PartialTVEpisodeImage;
}((0, swagger_1.OmitType)(TVEpisodeImage, [
    "createdTime",
    "lastUpdatedTime",
    "country",
])));
exports.PartialTVEpisodeImage = PartialTVEpisodeImage;
var TVEpisodeVideo = /** @class */ (function () {
    function TVEpisodeVideo() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeVideo.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], TVEpisodeVideo.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: languages_1.Language })
    ], TVEpisodeVideo.prototype, "language", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeVideo.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Boolean })
    ], TVEpisodeVideo.prototype, "official", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeVideo.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeVideo.prototype, "key", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeVideo.prototype, "site", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], TVEpisodeVideo.prototype, "size", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVEpisodeVideo.prototype, "filePath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], TVEpisodeVideo.prototype, "width", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], TVEpisodeVideo.prototype, "height", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVEpisodeVideo.prototype, "publishedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVEpisodeVideo.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVEpisodeVideo.prototype, "lastUpdatedTime", void 0);
    return TVEpisodeVideo;
}());
exports.TVEpisodeVideo = TVEpisodeVideo;
var PartialTVEpisodeVideo = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVEpisodeVideo, _super);
    function PartialTVEpisodeVideo() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialTVEpisodeVideo.prototype, "countryId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialTVEpisodeVideo.prototype, "languageId", void 0);
    return PartialTVEpisodeVideo;
}((0, swagger_1.OmitType)(TVEpisodeVideo, [
    "createdTime",
    "lastUpdatedTime",
    "language",
    "country",
])));
exports.PartialTVEpisodeVideo = PartialTVEpisodeVideo;
//# sourceMappingURL=tvEpisode.js.map