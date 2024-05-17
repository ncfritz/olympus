"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateMovieResponse = exports.CreateMovieRequest = exports.PartialMovieVideo = exports.MovieVideo = exports.PartialMovieSpokenLanguage = exports.MovieSpokenLanguage = exports.PartialMovieReleaseDate = exports.MovieReleaseDate = exports.PartialMovieProductionCountry = exports.MovieProductionCountry = exports.PartialMovieProductionCompany = exports.MovieProductionCompany = exports.PartialMovieKeyword = exports.MovieKeyword = exports.PartialMovieImage = exports.MovieImage = exports.PartialMovieGenre = exports.MovieGenre = exports.PartialMovieCrewMember = exports.MovieCrewMember = exports.PartialMovieCastMember = exports.MovieCastMember = exports.PartialMovieAlternativeTitle = exports.MovieAlternativeTitle = exports.PartialMovieExternalId = exports.MovieExternalId = exports.PartialMovie = exports.Movie = exports.BaseMovie = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var certifications_1 = require("./certifications");
var countries_1 = require("./countries");
var genres_1 = require("./genres");
var keywords_1 = require("./keywords");
var languages_1 = require("./languages");
var people_1 = require("./people");
var propductionCompanies_1 = require("./propductionCompanies");
var BaseMovie = /** @class */ (function () {
    function BaseMovie() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseMovie.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Boolean })
    ], BaseMovie.prototype, "adult", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseMovie.prototype, "backdropPath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseMovie.prototype, "budget", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseMovie.prototype, "homepage", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseMovie.prototype, "imdbId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: languages_1.Language })
    ], BaseMovie.prototype, "originalLanguage", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseMovie.prototype, "originalTitle", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseMovie.prototype, "overview", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseMovie.prototype, "posterPath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], BaseMovie.prototype, "releaseDate", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseMovie.prototype, "revenue", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseMovie.prototype, "runtime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseMovie.prototype, "status", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseMovie.prototype, "tagline", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseMovie.prototype, "title", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Boolean })
    ], BaseMovie.prototype, "video", void 0);
    return BaseMovie;
}());
exports.BaseMovie = BaseMovie;
var Movie = /** @class */ (function (_super) {
    tslib_1.__extends(Movie, _super);
    function Movie() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Movie.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Movie.prototype, "lastUpdatedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MovieAlternativeTitle; },
            isArray: true,
        })
    ], Movie.prototype, "alternativeTitles", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MovieCastMember; },
            isArray: true,
        })
    ], Movie.prototype, "cast", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MovieCrewMember; },
            isArray: true,
        })
    ], Movie.prototype, "crew", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MovieExternalId; },
            isArray: true,
        })
    ], Movie.prototype, "externalIds", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MovieGenre; },
            isArray: true,
        })
    ], Movie.prototype, "genres", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MovieImage; },
            isArray: true,
        })
    ], Movie.prototype, "images", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MovieKeyword; },
            isArray: true,
        })
    ], Movie.prototype, "keywords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MovieProductionCompany; },
            isArray: true,
        })
    ], Movie.prototype, "productionCompanies", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MovieProductionCountry; },
            isArray: true,
        })
    ], Movie.prototype, "productionCountries", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MovieReleaseDate; },
            isArray: true,
        })
    ], Movie.prototype, "releaseDates", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MovieSpokenLanguage; },
            isArray: true,
        })
    ], Movie.prototype, "spokenLanguages", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MovieVideo; },
            isArray: true,
        })
    ], Movie.prototype, "videos", void 0);
    return Movie;
}(BaseMovie));
exports.Movie = Movie;
var PartialMovie = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovie, _super);
    function PartialMovie() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return String; } })
    ], PartialMovie.prototype, "originalLanguageCode", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovieAlternativeTitle; },
            isArray: true,
        })
    ], PartialMovie.prototype, "alternativeTitles", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovieCastMember; },
            isArray: true,
        })
    ], PartialMovie.prototype, "cast", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovieCrewMember; },
            isArray: true,
        })
    ], PartialMovie.prototype, "crew", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovieExternalId; },
            isArray: true,
        })
    ], PartialMovie.prototype, "externalIds", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovieGenre; },
            isArray: true,
        })
    ], PartialMovie.prototype, "genres", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovieImage; },
            isArray: true,
        })
    ], PartialMovie.prototype, "images", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovieKeyword; },
            isArray: true,
        })
    ], PartialMovie.prototype, "keywords", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovieProductionCompany; },
            isArray: true,
        })
    ], PartialMovie.prototype, "productionCompanies", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovieProductionCountry; },
            isArray: true,
        })
    ], PartialMovie.prototype, "productionCountries", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovieReleaseDate; },
            isArray: true,
        })
    ], PartialMovie.prototype, "releaseDates", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovieSpokenLanguage; },
            isArray: true,
        })
    ], PartialMovie.prototype, "spokenLanguages", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovieVideo; },
            isArray: true,
        })
    ], PartialMovie.prototype, "videos", void 0);
    return PartialMovie;
}(BaseMovie));
exports.PartialMovie = PartialMovie;
var MovieExternalId = /** @class */ (function () {
    function MovieExternalId() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieExternalId.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieExternalId.prototype, "externalId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieExternalId.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieExternalId.prototype, "lastUpdatedTime", void 0);
    return MovieExternalId;
}());
exports.MovieExternalId = MovieExternalId;
var PartialMovieExternalId = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovieExternalId, _super);
    function PartialMovieExternalId() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialMovieExternalId;
}((0, swagger_1.OmitType)(MovieExternalId, [
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialMovieExternalId = PartialMovieExternalId;
var MovieAlternativeTitle = /** @class */ (function () {
    function MovieAlternativeTitle() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieAlternativeTitle.prototype, "title", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieAlternativeTitle.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], MovieAlternativeTitle.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieAlternativeTitle.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieAlternativeTitle.prototype, "lastUpdatedTime", void 0);
    return MovieAlternativeTitle;
}());
exports.MovieAlternativeTitle = MovieAlternativeTitle;
var PartialMovieAlternativeTitle = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovieAlternativeTitle, _super);
    function PartialMovieAlternativeTitle() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialMovieAlternativeTitle.prototype, "countryCode", void 0);
    return PartialMovieAlternativeTitle;
}((0, swagger_1.OmitType)(MovieAlternativeTitle, ["createdTime", "lastUpdatedTime", "country"])));
exports.PartialMovieAlternativeTitle = PartialMovieAlternativeTitle;
var MovieCastMember = /** @class */ (function () {
    function MovieCastMember() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieCastMember.prototype, "castId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: people_1.Person })
    ], MovieCastMember.prototype, "person", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieCastMember.prototype, "originalName", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieCastMember.prototype, "creditId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], MovieCastMember.prototype, "order", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieCastMember.prototype, "character", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieCastMember.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieCastMember.prototype, "lastUpdatedTime", void 0);
    return MovieCastMember;
}());
exports.MovieCastMember = MovieCastMember;
var PartialMovieCastMember = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovieCastMember, _super);
    function PartialMovieCastMember() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PartialMovieCastMember.prototype, "personId", void 0);
    return PartialMovieCastMember;
}((0, swagger_1.OmitType)(MovieCastMember, [
    "createdTime",
    "lastUpdatedTime",
    "person",
])));
exports.PartialMovieCastMember = PartialMovieCastMember;
var MovieCrewMember = /** @class */ (function () {
    function MovieCrewMember() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieCrewMember.prototype, "creditId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: people_1.Person })
    ], MovieCrewMember.prototype, "person", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieCrewMember.prototype, "originalName", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieCrewMember.prototype, "department", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieCrewMember.prototype, "job", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieCrewMember.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieCrewMember.prototype, "lastUpdatedTime", void 0);
    return MovieCrewMember;
}());
exports.MovieCrewMember = MovieCrewMember;
var PartialMovieCrewMember = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovieCrewMember, _super);
    function PartialMovieCrewMember() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PartialMovieCrewMember.prototype, "personId", void 0);
    return PartialMovieCrewMember;
}((0, swagger_1.OmitType)(MovieCrewMember, [
    "createdTime",
    "lastUpdatedTime",
    "person",
])));
exports.PartialMovieCrewMember = PartialMovieCrewMember;
var MovieGenre = /** @class */ (function () {
    function MovieGenre() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: genres_1.Genre })
    ], MovieGenre.prototype, "genre", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieGenre.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieGenre.prototype, "lastUpdatedTime", void 0);
    return MovieGenre;
}());
exports.MovieGenre = MovieGenre;
var PartialMovieGenre = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovieGenre, _super);
    function PartialMovieGenre() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PartialMovieGenre.prototype, "genreId", void 0);
    return PartialMovieGenre;
}((0, swagger_1.OmitType)(MovieGenre, [
    "createdTime",
    "lastUpdatedTime",
    "genre",
])));
exports.PartialMovieGenre = PartialMovieGenre;
var MovieImage = /** @class */ (function () {
    function MovieImage() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieImage.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieImage.prototype, "filePath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], MovieImage.prototype, "width", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], MovieImage.prototype, "height", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], MovieImage.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieImage.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieImage.prototype, "lastUpdatedTime", void 0);
    return MovieImage;
}());
exports.MovieImage = MovieImage;
var PartialMovieImage = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovieImage, _super);
    function PartialMovieImage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialMovieImage.prototype, "countryCode", void 0);
    return PartialMovieImage;
}((0, swagger_1.OmitType)(MovieImage, [
    "createdTime",
    "lastUpdatedTime",
    "country",
])));
exports.PartialMovieImage = PartialMovieImage;
var MovieKeyword = /** @class */ (function () {
    function MovieKeyword() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: keywords_1.Keyword })
    ], MovieKeyword.prototype, "keyword", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieKeyword.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieKeyword.prototype, "lastUpdatedTime", void 0);
    return MovieKeyword;
}());
exports.MovieKeyword = MovieKeyword;
var PartialMovieKeyword = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovieKeyword, _super);
    function PartialMovieKeyword() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PartialMovieKeyword.prototype, "keywordId", void 0);
    return PartialMovieKeyword;
}((0, swagger_1.OmitType)(MovieKeyword, [
    "createdTime",
    "lastUpdatedTime",
    "keyword",
])));
exports.PartialMovieKeyword = PartialMovieKeyword;
var MovieProductionCompany = /** @class */ (function () {
    function MovieProductionCompany() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: propductionCompanies_1.ProductionCompany })
    ], MovieProductionCompany.prototype, "productionCompany", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieProductionCompany.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieProductionCompany.prototype, "lastUpdatedTime", void 0);
    return MovieProductionCompany;
}());
exports.MovieProductionCompany = MovieProductionCompany;
var PartialMovieProductionCompany = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovieProductionCompany, _super);
    function PartialMovieProductionCompany() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PartialMovieProductionCompany.prototype, "productionCompanyId", void 0);
    return PartialMovieProductionCompany;
}((0, swagger_1.OmitType)(MovieProductionCompany, ["createdTime", "lastUpdatedTime", "productionCompany"])));
exports.PartialMovieProductionCompany = PartialMovieProductionCompany;
var MovieProductionCountry = /** @class */ (function () {
    function MovieProductionCountry() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], MovieProductionCountry.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieProductionCountry.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieProductionCountry.prototype, "lastUpdatedTime", void 0);
    return MovieProductionCountry;
}());
exports.MovieProductionCountry = MovieProductionCountry;
var PartialMovieProductionCountry = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovieProductionCountry, _super);
    function PartialMovieProductionCountry() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialMovieProductionCountry.prototype, "countryId", void 0);
    return PartialMovieProductionCountry;
}((0, swagger_1.OmitType)(MovieProductionCountry, ["createdTime", "lastUpdatedTime", "country"])));
exports.PartialMovieProductionCountry = PartialMovieProductionCountry;
var MovieReleaseDate = /** @class */ (function () {
    function MovieReleaseDate() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], MovieReleaseDate.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: languages_1.Language })
    ], MovieReleaseDate.prototype, "language", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieReleaseDate.prototype, "releaseDate", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], MovieReleaseDate.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieReleaseDate.prototype, "note", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: certifications_1.Certification })
    ], MovieReleaseDate.prototype, "certification", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieReleaseDate.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieReleaseDate.prototype, "lastUpdatedTime", void 0);
    return MovieReleaseDate;
}());
exports.MovieReleaseDate = MovieReleaseDate;
var PartialMovieReleaseDate = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovieReleaseDate, _super);
    function PartialMovieReleaseDate() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialMovieReleaseDate.prototype, "countryId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialMovieReleaseDate.prototype, "languageId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialMovieReleaseDate.prototype, "certificationId", void 0);
    return PartialMovieReleaseDate;
}((0, swagger_1.OmitType)(MovieReleaseDate, [
    "createdTime",
    "lastUpdatedTime",
    "country",
    "language",
    "certification",
])));
exports.PartialMovieReleaseDate = PartialMovieReleaseDate;
var MovieSpokenLanguage = /** @class */ (function () {
    function MovieSpokenLanguage() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: languages_1.Language })
    ], MovieSpokenLanguage.prototype, "language", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieSpokenLanguage.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieSpokenLanguage.prototype, "lastUpdatedTime", void 0);
    return MovieSpokenLanguage;
}());
exports.MovieSpokenLanguage = MovieSpokenLanguage;
var PartialMovieSpokenLanguage = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovieSpokenLanguage, _super);
    function PartialMovieSpokenLanguage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialMovieSpokenLanguage.prototype, "languageId", void 0);
    return PartialMovieSpokenLanguage;
}((0, swagger_1.OmitType)(MovieSpokenLanguage, [
    "createdTime",
    "lastUpdatedTime",
    "language",
])));
exports.PartialMovieSpokenLanguage = PartialMovieSpokenLanguage;
var MovieVideo = /** @class */ (function () {
    function MovieVideo() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieVideo.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], MovieVideo.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: languages_1.Language })
    ], MovieVideo.prototype, "language", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieVideo.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieVideo.prototype, "key", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieVideo.prototype, "site", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], MovieVideo.prototype, "size", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MovieVideo.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Boolean })
    ], MovieVideo.prototype, "official", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieVideo.prototype, "publishedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieVideo.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], MovieVideo.prototype, "lastUpdatedTime", void 0);
    return MovieVideo;
}());
exports.MovieVideo = MovieVideo;
var PartialMovieVideo = /** @class */ (function (_super) {
    tslib_1.__extends(PartialMovieVideo, _super);
    function PartialMovieVideo() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialMovieVideo.prototype, "countryId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialMovieVideo.prototype, "languageId", void 0);
    return PartialMovieVideo;
}((0, swagger_1.OmitType)(MovieVideo, [
    "createdTime",
    "lastUpdatedTime",
    "language",
    "country",
])));
exports.PartialMovieVideo = PartialMovieVideo;
var CreateMovieRequest = /** @class */ (function () {
    function CreateMovieRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialMovie; },
        })
    ], CreateMovieRequest.prototype, "movie", void 0);
    return CreateMovieRequest;
}());
exports.CreateMovieRequest = CreateMovieRequest;
var CreateMovieResponse = /** @class */ (function () {
    function CreateMovieResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Movie; },
        })
    ], CreateMovieResponse.prototype, "movie", void 0);
    return CreateMovieResponse;
}());
exports.CreateMovieResponse = CreateMovieResponse;
//# sourceMappingURL=movies.js.map