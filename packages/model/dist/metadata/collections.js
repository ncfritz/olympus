"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCollectionResponse = exports.CreateCollectionRequest = exports.PartialCollectionImage = exports.CollectionImage = exports.PartialCollectionPart = exports.CollectionPart = exports.PartialCollection = exports.Collection = exports.BaseCollection = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var countries_1 = require("./countries");
var movies_1 = require("./movies");
var BaseCollection = /** @class */ (function () {
    function BaseCollection() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseCollection.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseCollection.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseCollection.prototype, "overview", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseCollection.prototype, "posterPath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseCollection.prototype, "backdropPath", void 0);
    return BaseCollection;
}());
exports.BaseCollection = BaseCollection;
var Collection = /** @class */ (function (_super) {
    tslib_1.__extends(Collection, _super);
    function Collection() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Collection.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Collection.prototype, "lastUpdatedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return CollectionPart; },
            isArray: true,
        })
    ], Collection.prototype, "parts", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return CollectionImage; },
            isArray: true,
        })
    ], Collection.prototype, "images", void 0);
    return Collection;
}(BaseCollection));
exports.Collection = Collection;
var PartialCollection = /** @class */ (function (_super) {
    tslib_1.__extends(PartialCollection, _super);
    function PartialCollection() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialCollectionPart; },
            isArray: true,
        })
    ], PartialCollection.prototype, "parts", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialCollectionImage; },
            isArray: true,
        })
    ], PartialCollection.prototype, "images", void 0);
    return PartialCollection;
}(BaseCollection));
exports.PartialCollection = PartialCollection;
var CollectionPart = /** @class */ (function () {
    function CollectionPart() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: movies_1.Movie })
    ], CollectionPart.prototype, "movie", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], CollectionPart.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], CollectionPart.prototype, "lastUpdatedTime", void 0);
    return CollectionPart;
}());
exports.CollectionPart = CollectionPart;
var PartialCollectionPart = /** @class */ (function (_super) {
    tslib_1.__extends(PartialCollectionPart, _super);
    function PartialCollectionPart() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialCollectionPart.prototype, "movieId", void 0);
    return PartialCollectionPart;
}((0, swagger_1.OmitType)(CollectionPart, [
    "createdTime",
    "lastUpdatedTime",
    "movie",
])));
exports.PartialCollectionPart = PartialCollectionPart;
var CollectionImage = /** @class */ (function () {
    function CollectionImage() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], CollectionImage.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], CollectionImage.prototype, "filePath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], CollectionImage.prototype, "width", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], CollectionImage.prototype, "height", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], CollectionImage.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], CollectionImage.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], CollectionImage.prototype, "lastUpdatedTime", void 0);
    return CollectionImage;
}());
exports.CollectionImage = CollectionImage;
var PartialCollectionImage = /** @class */ (function (_super) {
    tslib_1.__extends(PartialCollectionImage, _super);
    function PartialCollectionImage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialCollectionImage.prototype, "countryCode", void 0);
    return PartialCollectionImage;
}((0, swagger_1.OmitType)(CollectionImage, [
    "createdTime",
    "lastUpdatedTime",
    "country",
])));
exports.PartialCollectionImage = PartialCollectionImage;
var CreateCollectionRequest = /** @class */ (function () {
    function CreateCollectionRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialCollection; },
        })
    ], CreateCollectionRequest.prototype, "collection", void 0);
    return CreateCollectionRequest;
}());
exports.CreateCollectionRequest = CreateCollectionRequest;
var CreateCollectionResponse = /** @class */ (function () {
    function CreateCollectionResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Collection; },
        })
    ], CreateCollectionResponse.prototype, "collection", void 0);
    return CreateCollectionResponse;
}());
exports.CreateCollectionResponse = CreateCollectionResponse;
//# sourceMappingURL=collections.js.map