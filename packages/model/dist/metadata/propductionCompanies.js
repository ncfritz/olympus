"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateProductionCompanyResponse = exports.CreateProductionCompanyRequest = exports.PartialProductionCompanyLogo = exports.ProductionCompanyLogo = exports.PartialProductionCompanyAlternativeName = exports.ProductionCompanyAlternativeName = exports.PartialProductionCompany = exports.ProductionCompany = exports.BaseProductionCompany = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var BaseProductionCompany = /** @class */ (function () {
    function BaseProductionCompany() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseProductionCompany.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseProductionCompany.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseProductionCompany.prototype, "description", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseProductionCompany.prototype, "headquarters", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseProductionCompany.prototype, "homepage", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseProductionCompany.prototype, "logoPath", void 0);
    return BaseProductionCompany;
}());
exports.BaseProductionCompany = BaseProductionCompany;
var ProductionCompany = /** @class */ (function (_super) {
    tslib_1.__extends(ProductionCompany, _super);
    function ProductionCompany() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], ProductionCompany.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], ProductionCompany.prototype, "lastUpdatedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return ProductionCompanyAlternativeName; },
            isArray: true,
        })
    ], ProductionCompany.prototype, "alternativeNames", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return ProductionCompanyLogo; }, isArray: true })
    ], ProductionCompany.prototype, "logos", void 0);
    return ProductionCompany;
}(BaseProductionCompany));
exports.ProductionCompany = ProductionCompany;
var PartialProductionCompany = /** @class */ (function (_super) {
    tslib_1.__extends(PartialProductionCompany, _super);
    function PartialProductionCompany() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialProductionCompany.prototype, "originCountry", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialProductionCompany.prototype, "parentCompanyId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialProductionCompanyAlternativeName; },
            isArray: true,
        })
    ], PartialProductionCompany.prototype, "alternativeNames", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return PartialProductionCompanyLogo; }, isArray: true })
    ], PartialProductionCompany.prototype, "logos", void 0);
    return PartialProductionCompany;
}(BaseProductionCompany));
exports.PartialProductionCompany = PartialProductionCompany;
var ProductionCompanyAlternativeName = /** @class */ (function () {
    function ProductionCompanyAlternativeName() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ProductionCompanyAlternativeName.prototype, "productionCompanyId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], ProductionCompanyAlternativeName.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], ProductionCompanyAlternativeName.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], ProductionCompanyAlternativeName.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], ProductionCompanyAlternativeName.prototype, "lastUpdatedTime", void 0);
    return ProductionCompanyAlternativeName;
}());
exports.ProductionCompanyAlternativeName = ProductionCompanyAlternativeName;
var PartialProductionCompanyAlternativeName = /** @class */ (function (_super) {
    tslib_1.__extends(PartialProductionCompanyAlternativeName, _super);
    function PartialProductionCompanyAlternativeName() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialProductionCompanyAlternativeName;
}((0, swagger_1.OmitType)(ProductionCompanyAlternativeName, ["createdTime", "lastUpdatedTime"])));
exports.PartialProductionCompanyAlternativeName = PartialProductionCompanyAlternativeName;
var ProductionCompanyLogo = /** @class */ (function () {
    function ProductionCompanyLogo() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ProductionCompanyLogo.prototype, "productionCompanyId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], ProductionCompanyLogo.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], ProductionCompanyLogo.prototype, "filePath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], ProductionCompanyLogo.prototype, "fileType", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ProductionCompanyLogo.prototype, "width", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], ProductionCompanyLogo.prototype, "height", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], ProductionCompanyLogo.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], ProductionCompanyLogo.prototype, "lastUpdatedTime", void 0);
    return ProductionCompanyLogo;
}());
exports.ProductionCompanyLogo = ProductionCompanyLogo;
var PartialProductionCompanyLogo = /** @class */ (function (_super) {
    tslib_1.__extends(PartialProductionCompanyLogo, _super);
    function PartialProductionCompanyLogo() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialProductionCompanyLogo;
}((0, swagger_1.OmitType)(ProductionCompanyLogo, ["createdTime", "lastUpdatedTime"])));
exports.PartialProductionCompanyLogo = PartialProductionCompanyLogo;
var CreateProductionCompanyRequest = /** @class */ (function () {
    function CreateProductionCompanyRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialProductionCompany; },
        })
    ], CreateProductionCompanyRequest.prototype, "company", void 0);
    return CreateProductionCompanyRequest;
}());
exports.CreateProductionCompanyRequest = CreateProductionCompanyRequest;
var CreateProductionCompanyResponse = /** @class */ (function () {
    function CreateProductionCompanyResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return ProductionCompany; },
        })
    ], CreateProductionCompanyResponse.prototype, "company", void 0);
    return CreateProductionCompanyResponse;
}());
exports.CreateProductionCompanyResponse = CreateProductionCompanyResponse;
//# sourceMappingURL=propductionCompanies.js.map