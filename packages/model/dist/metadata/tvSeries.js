"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartialTVSeriesVideo = exports.TVSeriesVideo = exports.PartialTVSeriesSpokenLanguage = exports.TVSeriesSpokenLanguage = exports.PartialTVSeriesProductionCompany = exports.TVSeriesProductionCompany = exports.PartialTVSeriesCountry = exports.TVSeriesCountry = exports.PartialTVSeriesNetwork = exports.TVSeriesNetwork = exports.PartialTVSeriesLanguage = exports.TVSeriesLanguage = exports.PartialTVSeriesKeyword = exports.TVSeriesKeyword = exports.PartialTVSeriesImage = exports.TVSeriesImage = exports.PartialTVSeriesGenre = exports.TVSeriesGenre = exports.PartialTVSeriesRuntime = exports.TVSeriesRuntime = exports.PartialTVSeriesCrewMember = exports.TVSeriesCrewMember = exports.PartialTVSeriesCastMember = exports.TVSeriesCastMember = exports.PartialTVSeriesAlternativeTitle = exports.TVSeriesAlternativeTitle = exports.PartialTVSeries = exports.TVSeries = exports.BaseTVSeries = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var certifications_1 = require("./certifications");
var countries_1 = require("./countries");
var genres_1 = require("./genres");
var keywords_1 = require("./keywords");
var languages_1 = require("./languages");
var networks_1 = require("./networks");
var people_1 = require("./people");
var tvEpisode_1 = require("./tvEpisode");
var tvSeason_1 = require("./tvSeason");
var BaseTVSeries = /** @class */ (function () {
    function BaseTVSeries() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseTVSeries.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Boolean })
    ], BaseTVSeries.prototype, "adult", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseTVSeries.prototype, "backdropPath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], BaseTVSeries.prototype, "firstAirDate", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseTVSeries.prototype, "homepage", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Boolean })
    ], BaseTVSeries.prototype, "inProduction", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], BaseTVSeries.prototype, "lastAirDate", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseTVSeries.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseTVSeries.prototype, "numberOfEpisodes", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseTVSeries.prototype, "numberOfSeasons", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: languages_1.Language })
    ], BaseTVSeries.prototype, "originalLanguage", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseTVSeries.prototype, "originalName", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseTVSeries.prototype, "overview", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseTVSeries.prototype, "posterPath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseTVSeries.prototype, "status", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseTVSeries.prototype, "tagline", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseTVSeries.prototype, "type", void 0);
    return BaseTVSeries;
}());
exports.BaseTVSeries = BaseTVSeries;
var TVSeries = /** @class */ (function (_super) {
    tslib_1.__extends(TVSeries, _super);
    function TVSeries() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeries.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeries.prototype, "lastUpdatedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: tvEpisode_1.Episode })
    ], TVSeries.prototype, "lastEpisodeToAir", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeriesAlternativeTitle; },
            isArray: true,
        })
    ], TVSeries.prototype, "alternativeTitles", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeriesCastMember; },
            isArray: true,
        })
    ], TVSeries.prototype, "cast", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return certifications_1.Certification; },
            isArray: true,
        })
    ], TVSeries.prototype, "certifications", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeriesCrewMember; },
            isArray: true,
        })
    ], TVSeries.prototype, "crew", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeriesRuntime; },
            isArray: true,
        })
    ], TVSeries.prototype, "runtimes", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: tvEpisode_1.Episode, isArray: true })
    ], TVSeries.prototype, "episodes", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeriesGenre; },
            isArray: true,
        })
    ], TVSeries.prototype, "genres", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeriesImage; },
            isArray: true,
        })
    ], TVSeries.prototype, "images", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeriesKeyword; },
            isArray: true,
        })
    ], TVSeries.prototype, "keywords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeriesLanguage; },
            isArray: true,
        })
    ], TVSeries.prototype, "languages", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeriesNetwork; },
            isArray: true,
        })
    ], TVSeries.prototype, "networks", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeriesCountry; },
            isArray: true,
        })
    ], TVSeries.prototype, "originCountry", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeriesProductionCompany; },
            isArray: true,
        })
    ], TVSeries.prototype, "productionCompanies", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return TVSeriesCountry; },
            isArray: true,
        })
    ], TVSeries.prototype, "productionCountries", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: tvSeason_1.Season, isArray: true })
    ], TVSeries.prototype, "seasons", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return TVSeriesSpokenLanguage; }, isArray: true })
    ], TVSeries.prototype, "spokenLanguages", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return TVSeriesVideo; }, isArray: true })
    ], TVSeries.prototype, "videos", void 0);
    return TVSeries;
}(BaseTVSeries));
exports.TVSeries = TVSeries;
var PartialTVSeries = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeries, _super);
    function PartialTVSeries() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return String; } })
    ], PartialTVSeries.prototype, "originalLanguageCode", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesAlternativeTitle; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "alternativeTitles", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesCastMember; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "cast", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return certifications_1.PartialCertification; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "certifications", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesCrewMember; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "crew", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesRuntime; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "runtimes", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return tvEpisode_1.PartialEpisode; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "episodes", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesGenre; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "genres", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesImage; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "images", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesKeyword; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "keywords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesLanguage; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "languages", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesNetwork; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "networks", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesCountry; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "originCountries", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesProductionCompany; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "productionCompanies", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesCountry; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "productionCountries", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return tvSeason_1.PartialSeason; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "seasons", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return PartialTVSeriesSpokenLanguage; }, isArray: true })
    ], PartialTVSeries.prototype, "spokenLanguages", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialTVSeriesVideo; },
            isArray: true,
        })
    ], PartialTVSeries.prototype, "videos", void 0);
    return PartialTVSeries;
}(BaseTVSeries));
exports.PartialTVSeries = PartialTVSeries;
var TVSeriesAlternativeTitle = /** @class */ (function () {
    function TVSeriesAlternativeTitle() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesAlternativeTitle.prototype, "title", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesAlternativeTitle.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], TVSeriesAlternativeTitle.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesAlternativeTitle.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesAlternativeTitle.prototype, "lastUpdatedTime", void 0);
    return TVSeriesAlternativeTitle;
}());
exports.TVSeriesAlternativeTitle = TVSeriesAlternativeTitle;
var PartialTVSeriesAlternativeTitle = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesAlternativeTitle, _super);
    function PartialTVSeriesAlternativeTitle() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialTVSeriesAlternativeTitle.prototype, "countryCode", void 0);
    return PartialTVSeriesAlternativeTitle;
}((0, swagger_1.OmitType)(TVSeriesAlternativeTitle, ["createdTime", "lastUpdatedTime", "country"])));
exports.PartialTVSeriesAlternativeTitle = PartialTVSeriesAlternativeTitle;
var TVSeriesCastMember = /** @class */ (function () {
    function TVSeriesCastMember() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesCastMember.prototype, "castId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: people_1.Person })
    ], TVSeriesCastMember.prototype, "person", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesCastMember.prototype, "originalName", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], TVSeriesCastMember.prototype, "order", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesCastMember.prototype, "character", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesCastMember.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesCastMember.prototype, "lastUpdatedTime", void 0);
    return TVSeriesCastMember;
}());
exports.TVSeriesCastMember = TVSeriesCastMember;
var PartialTVSeriesCastMember = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesCastMember, _super);
    function PartialTVSeriesCastMember() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PartialTVSeriesCastMember.prototype, "personId", void 0);
    return PartialTVSeriesCastMember;
}((0, swagger_1.OmitType)(TVSeriesCastMember, [
    "createdTime",
    "lastUpdatedTime",
    "person",
])));
exports.PartialTVSeriesCastMember = PartialTVSeriesCastMember;
var TVSeriesCrewMember = /** @class */ (function () {
    function TVSeriesCrewMember() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesCrewMember.prototype, "creditId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: people_1.Person })
    ], TVSeriesCrewMember.prototype, "person", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesCrewMember.prototype, "originalName", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesCrewMember.prototype, "department", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesCrewMember.prototype, "job", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesCrewMember.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesCrewMember.prototype, "lastUpdatedTime", void 0);
    return TVSeriesCrewMember;
}());
exports.TVSeriesCrewMember = TVSeriesCrewMember;
var PartialTVSeriesCrewMember = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesCrewMember, _super);
    function PartialTVSeriesCrewMember() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PartialTVSeriesCrewMember.prototype, "personId", void 0);
    return PartialTVSeriesCrewMember;
}((0, swagger_1.OmitType)(TVSeriesCrewMember, [
    "createdTime",
    "lastUpdatedTime",
    "person",
])));
exports.PartialTVSeriesCrewMember = PartialTVSeriesCrewMember;
var TVSeriesRuntime = /** @class */ (function () {
    function TVSeriesRuntime() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesRuntime.prototype, "runtime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesRuntime.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesRuntime.prototype, "lastUpdatedTime", void 0);
    return TVSeriesRuntime;
}());
exports.TVSeriesRuntime = TVSeriesRuntime;
var PartialTVSeriesRuntime = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesRuntime, _super);
    function PartialTVSeriesRuntime() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialTVSeriesRuntime;
}((0, swagger_1.OmitType)(TVSeriesRuntime, [
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialTVSeriesRuntime = PartialTVSeriesRuntime;
var TVSeriesGenre = /** @class */ (function () {
    function TVSeriesGenre() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: genres_1.Genre })
    ], TVSeriesGenre.prototype, "genre", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesGenre.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesGenre.prototype, "lastUpdatedTime", void 0);
    return TVSeriesGenre;
}());
exports.TVSeriesGenre = TVSeriesGenre;
var PartialTVSeriesGenre = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesGenre, _super);
    function PartialTVSeriesGenre() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PartialTVSeriesGenre.prototype, "genreId", void 0);
    return PartialTVSeriesGenre;
}((0, swagger_1.OmitType)(TVSeriesGenre, [
    "createdTime",
    "lastUpdatedTime",
    "genre",
])));
exports.PartialTVSeriesGenre = PartialTVSeriesGenre;
var TVSeriesImage = /** @class */ (function () {
    function TVSeriesImage() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesImage.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesImage.prototype, "filePath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], TVSeriesImage.prototype, "width", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], TVSeriesImage.prototype, "height", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], TVSeriesImage.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesImage.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesImage.prototype, "lastUpdatedTime", void 0);
    return TVSeriesImage;
}());
exports.TVSeriesImage = TVSeriesImage;
var PartialTVSeriesImage = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesImage, _super);
    function PartialTVSeriesImage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialTVSeriesImage.prototype, "countryCode", void 0);
    return PartialTVSeriesImage;
}((0, swagger_1.OmitType)(TVSeriesImage, [
    "createdTime",
    "lastUpdatedTime",
    "country",
])));
exports.PartialTVSeriesImage = PartialTVSeriesImage;
var TVSeriesKeyword = /** @class */ (function () {
    function TVSeriesKeyword() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: keywords_1.Keyword })
    ], TVSeriesKeyword.prototype, "keyword", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesKeyword.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesKeyword.prototype, "lastUpdatedTime", void 0);
    return TVSeriesKeyword;
}());
exports.TVSeriesKeyword = TVSeriesKeyword;
var PartialTVSeriesKeyword = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesKeyword, _super);
    function PartialTVSeriesKeyword() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PartialTVSeriesKeyword.prototype, "keywordId", void 0);
    return PartialTVSeriesKeyword;
}((0, swagger_1.OmitType)(TVSeriesKeyword, [
    "createdTime",
    "lastUpdatedTime",
    "keyword",
])));
exports.PartialTVSeriesKeyword = PartialTVSeriesKeyword;
var TVSeriesLanguage = /** @class */ (function () {
    function TVSeriesLanguage() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: languages_1.Language })
    ], TVSeriesLanguage.prototype, "language", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesLanguage.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesLanguage.prototype, "lastUpdatedTime", void 0);
    return TVSeriesLanguage;
}());
exports.TVSeriesLanguage = TVSeriesLanguage;
var PartialTVSeriesLanguage = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesLanguage, _super);
    function PartialTVSeriesLanguage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialTVSeriesLanguage.prototype, "languageId", void 0);
    return PartialTVSeriesLanguage;
}((0, swagger_1.OmitType)(TVSeriesLanguage, [
    "createdTime",
    "lastUpdatedTime",
    "language",
])));
exports.PartialTVSeriesLanguage = PartialTVSeriesLanguage;
var TVSeriesNetwork = /** @class */ (function () {
    function TVSeriesNetwork() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: networks_1.Network })
    ], TVSeriesNetwork.prototype, "network", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesNetwork.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesNetwork.prototype, "lastUpdatedTime", void 0);
    return TVSeriesNetwork;
}());
exports.TVSeriesNetwork = TVSeriesNetwork;
var PartialTVSeriesNetwork = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesNetwork, _super);
    function PartialTVSeriesNetwork() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PartialTVSeriesNetwork.prototype, "networkId", void 0);
    return PartialTVSeriesNetwork;
}((0, swagger_1.OmitType)(TVSeriesNetwork, [
    "createdTime",
    "lastUpdatedTime",
    "network",
])));
exports.PartialTVSeriesNetwork = PartialTVSeriesNetwork;
var TVSeriesCountry = /** @class */ (function () {
    function TVSeriesCountry() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], TVSeriesCountry.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesCountry.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesCountry.prototype, "lastUpdatedTime", void 0);
    return TVSeriesCountry;
}());
exports.TVSeriesCountry = TVSeriesCountry;
var PartialTVSeriesCountry = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesCountry, _super);
    function PartialTVSeriesCountry() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialTVSeriesCountry.prototype, "countryId", void 0);
    return PartialTVSeriesCountry;
}((0, swagger_1.OmitType)(TVSeriesCountry, [
    "createdTime",
    "lastUpdatedTime",
    "country",
])));
exports.PartialTVSeriesCountry = PartialTVSeriesCountry;
var TVSeriesProductionCompany = /** @class */ (function () {
    function TVSeriesProductionCompany() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], TVSeriesProductionCompany.prototype, "productionCompany", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesProductionCompany.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesProductionCompany.prototype, "lastUpdatedTime", void 0);
    return TVSeriesProductionCompany;
}());
exports.TVSeriesProductionCompany = TVSeriesProductionCompany;
var PartialTVSeriesProductionCompany = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesProductionCompany, _super);
    function PartialTVSeriesProductionCompany() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PartialTVSeriesProductionCompany.prototype, "productionCompanyId", void 0);
    return PartialTVSeriesProductionCompany;
}((0, swagger_1.OmitType)(TVSeriesProductionCompany, ["createdTime", "lastUpdatedTime", "productionCompany"])));
exports.PartialTVSeriesProductionCompany = PartialTVSeriesProductionCompany;
var TVSeriesSpokenLanguage = /** @class */ (function () {
    function TVSeriesSpokenLanguage() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: languages_1.Language })
    ], TVSeriesSpokenLanguage.prototype, "language", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesSpokenLanguage.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesSpokenLanguage.prototype, "lastUpdatedTime", void 0);
    return TVSeriesSpokenLanguage;
}());
exports.TVSeriesSpokenLanguage = TVSeriesSpokenLanguage;
var PartialTVSeriesSpokenLanguage = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesSpokenLanguage, _super);
    function PartialTVSeriesSpokenLanguage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialTVSeriesSpokenLanguage.prototype, "languageId", void 0);
    return PartialTVSeriesSpokenLanguage;
}((0, swagger_1.OmitType)(TVSeriesSpokenLanguage, ["createdTime", "lastUpdatedTime", "language"])));
exports.PartialTVSeriesSpokenLanguage = PartialTVSeriesSpokenLanguage;
var TVSeriesVideo = /** @class */ (function () {
    function TVSeriesVideo() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesVideo.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], TVSeriesVideo.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: languages_1.Language })
    ], TVSeriesVideo.prototype, "language", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesVideo.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesVideo.prototype, "key", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesVideo.prototype, "site", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], TVSeriesVideo.prototype, "size", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], TVSeriesVideo.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Boolean })
    ], TVSeriesVideo.prototype, "official", void 0);
    tslib_1.__decorate([
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesVideo.prototype, "publishedTime", void 0);
    tslib_1.__decorate([
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesVideo.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], TVSeriesVideo.prototype, "lastUpdatedTime", void 0);
    return TVSeriesVideo;
}());
exports.TVSeriesVideo = TVSeriesVideo;
var PartialTVSeriesVideo = /** @class */ (function (_super) {
    tslib_1.__extends(PartialTVSeriesVideo, _super);
    function PartialTVSeriesVideo() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialTVSeriesVideo.prototype, "countryId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialTVSeriesVideo.prototype, "languageId", void 0);
    return PartialTVSeriesVideo;
}((0, swagger_1.OmitType)(TVSeriesVideo, [
    "createdTime",
    "lastUpdatedTime",
    "language",
    "country",
])));
exports.PartialTVSeriesVideo = PartialTVSeriesVideo;
//# sourceMappingURL=tvSeries.js.map