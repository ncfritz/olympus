"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListCountriesResponse = exports.CreateCountryResponse = exports.CreateCountryRequest = exports.PartialCountry = exports.Country = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var ModelCommon_1 = require("../ModelCommon");
var Country = /** @class */ (function () {
    function Country() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Country.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Country.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Country.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Country.prototype, "lastUpdatedTime", void 0);
    return Country;
}());
exports.Country = Country;
var PartialCountry = /** @class */ (function (_super) {
    tslib_1.__extends(PartialCountry, _super);
    function PartialCountry() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialCountry;
}((0, swagger_1.OmitType)(Country, [
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialCountry = PartialCountry;
var CreateCountryRequest = /** @class */ (function () {
    function CreateCountryRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Country; },
        })
    ], CreateCountryRequest.prototype, "country", void 0);
    return CreateCountryRequest;
}());
exports.CreateCountryRequest = CreateCountryRequest;
var CreateCountryResponse = /** @class */ (function () {
    function CreateCountryResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Country; },
        })
    ], CreateCountryResponse.prototype, "country", void 0);
    return CreateCountryResponse;
}());
exports.CreateCountryResponse = CreateCountryResponse;
var ListCountriesResponse = /** @class */ (function (_super) {
    tslib_1.__extends(ListCountriesResponse, _super);
    function ListCountriesResponse() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return Country; }, isArray: true })
    ], ListCountriesResponse.prototype, "countries", void 0);
    return ListCountriesResponse;
}(ModelCommon_1.PaginatedResults));
exports.ListCountriesResponse = ListCountriesResponse;
//# sourceMappingURL=countries.js.map