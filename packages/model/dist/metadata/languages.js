"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListLanguagesResponse = exports.CreateLanguageResponse = exports.CreateLanguageRequest = exports.PartialLanguage = exports.Language = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var ModelCommon_1 = require("../ModelCommon");
var Language = /** @class */ (function () {
    function Language() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Language.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Language.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Language.prototype, "nativeName", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Language.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Language.prototype, "lastUpdatedTime", void 0);
    return Language;
}());
exports.Language = Language;
var PartialLanguage = /** @class */ (function (_super) {
    tslib_1.__extends(PartialLanguage, _super);
    function PartialLanguage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialLanguage;
}((0, swagger_1.OmitType)(Language, [
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialLanguage = PartialLanguage;
var CreateLanguageRequest = /** @class */ (function () {
    function CreateLanguageRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Language; },
        })
    ], CreateLanguageRequest.prototype, "language", void 0);
    return CreateLanguageRequest;
}());
exports.CreateLanguageRequest = CreateLanguageRequest;
var CreateLanguageResponse = /** @class */ (function () {
    function CreateLanguageResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Language; },
        })
    ], CreateLanguageResponse.prototype, "language", void 0);
    return CreateLanguageResponse;
}());
exports.CreateLanguageResponse = CreateLanguageResponse;
var ListLanguagesResponse = /** @class */ (function (_super) {
    tslib_1.__extends(ListLanguagesResponse, _super);
    function ListLanguagesResponse() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return Language; }, isArray: true })
    ], ListLanguagesResponse.prototype, "languages", void 0);
    return ListLanguagesResponse;
}(ModelCommon_1.PaginatedResults));
exports.ListLanguagesResponse = ListLanguagesResponse;
//# sourceMappingURL=languages.js.map