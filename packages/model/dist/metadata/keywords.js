"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListKeywordsResponse = exports.CreateKeywordResponse = exports.CreateKeywordRequest = exports.PartialKeyword = exports.Keyword = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var ModelCommon_1 = require("../ModelCommon");
var Keyword = /** @class */ (function () {
    function Keyword() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Keyword.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Keyword.prototype, "value", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Keyword.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Keyword.prototype, "lastUpdatedTime", void 0);
    return Keyword;
}());
exports.Keyword = Keyword;
var PartialKeyword = /** @class */ (function (_super) {
    tslib_1.__extends(PartialKeyword, _super);
    function PartialKeyword() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialKeyword;
}((0, swagger_1.OmitType)(Keyword, [
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialKeyword = PartialKeyword;
var CreateKeywordRequest = /** @class */ (function () {
    function CreateKeywordRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialKeyword; },
        })
    ], CreateKeywordRequest.prototype, "keyword", void 0);
    return CreateKeywordRequest;
}());
exports.CreateKeywordRequest = CreateKeywordRequest;
var CreateKeywordResponse = /** @class */ (function () {
    function CreateKeywordResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Keyword; },
        })
    ], CreateKeywordResponse.prototype, "keyword", void 0);
    return CreateKeywordResponse;
}());
exports.CreateKeywordResponse = CreateKeywordResponse;
var ListKeywordsResponse = /** @class */ (function (_super) {
    tslib_1.__extends(ListKeywordsResponse, _super);
    function ListKeywordsResponse() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return Keyword; }, isArray: true })
    ], ListKeywordsResponse.prototype, "keywords", void 0);
    return ListKeywordsResponse;
}(ModelCommon_1.PaginatedResults));
exports.ListKeywordsResponse = ListKeywordsResponse;
//# sourceMappingURL=keywords.js.map