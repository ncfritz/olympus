"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListGenresResponse = exports.CreateGenreResponse = exports.CreateGenreRequest = exports.PartialGenre = exports.Genre = exports.GenreType = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var ModelCommon_1 = require("../ModelCommon");
var languages_1 = require("./languages");
var GenreType;
(function (GenreType) {
    GenreType["TV"] = "TV";
    GenreType["MOVIE"] = "Movie";
})(GenreType || (exports.GenreType = GenreType = {}));
var Genre = /** @class */ (function () {
    function Genre() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], Genre.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: GenreType })
    ], Genre.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Genre.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Genre.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Genre.prototype, "lastUpdatedTime", void 0);
    return Genre;
}());
exports.Genre = Genre;
var PartialGenre = /** @class */ (function (_super) {
    tslib_1.__extends(PartialGenre, _super);
    function PartialGenre() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialGenre;
}((0, swagger_1.OmitType)(Genre, [
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialGenre = PartialGenre;
var CreateGenreRequest = /** @class */ (function () {
    function CreateGenreRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return languages_1.Language; },
        })
    ], CreateGenreRequest.prototype, "genre", void 0);
    return CreateGenreRequest;
}());
exports.CreateGenreRequest = CreateGenreRequest;
var CreateGenreResponse = /** @class */ (function () {
    function CreateGenreResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Genre; },
        })
    ], CreateGenreResponse.prototype, "genre", void 0);
    return CreateGenreResponse;
}());
exports.CreateGenreResponse = CreateGenreResponse;
var ListGenresResponse = /** @class */ (function (_super) {
    tslib_1.__extends(ListGenresResponse, _super);
    function ListGenresResponse() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return Genre; }, isArray: true })
    ], ListGenresResponse.prototype, "genres", void 0);
    return ListGenresResponse;
}(ModelCommon_1.PaginatedResults));
exports.ListGenresResponse = ListGenresResponse;
//# sourceMappingURL=genres.js.map