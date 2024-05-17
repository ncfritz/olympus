"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListCertificationsResponse = exports.GetCertificationResponse = exports.CreateCertificationResponse = exports.CreateCertificationRequest = exports.PartialCertification = exports.Certification = exports.CertificationType = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var ModelCommon_1 = require("../ModelCommon");
var CertificationType;
(function (CertificationType) {
    CertificationType["TV"] = "TV";
    CertificationType["MOVIE"] = "Movie";
})(CertificationType || (exports.CertificationType = CertificationType = {}));
var Certification = /** @class */ (function () {
    function Certification() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Certification.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Certification.prototype, "certification", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: CertificationType })
    ], Certification.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], Certification.prototype, "order", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Certification.prototype, "meaning", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Certification.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Certification.prototype, "lastUpdatedTime", void 0);
    return Certification;
}());
exports.Certification = Certification;
var PartialCertification = /** @class */ (function (_super) {
    tslib_1.__extends(PartialCertification, _super);
    function PartialCertification() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialCertification;
}((0, swagger_1.OmitType)(Certification, [
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialCertification = PartialCertification;
var CreateCertificationRequest = /** @class */ (function () {
    function CreateCertificationRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Certification; },
        })
    ], CreateCertificationRequest.prototype, "certification", void 0);
    return CreateCertificationRequest;
}());
exports.CreateCertificationRequest = CreateCertificationRequest;
var CreateCertificationResponse = /** @class */ (function () {
    function CreateCertificationResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Certification; },
        })
    ], CreateCertificationResponse.prototype, "certification", void 0);
    return CreateCertificationResponse;
}());
exports.CreateCertificationResponse = CreateCertificationResponse;
var GetCertificationResponse = /** @class */ (function () {
    function GetCertificationResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Certification; },
        })
    ], GetCertificationResponse.prototype, "certification", void 0);
    return GetCertificationResponse;
}());
exports.GetCertificationResponse = GetCertificationResponse;
var ListCertificationsResponse = /** @class */ (function (_super) {
    tslib_1.__extends(ListCertificationsResponse, _super);
    function ListCertificationsResponse() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return Certification; }, isArray: true })
    ], ListCertificationsResponse.prototype, "certifications", void 0);
    return ListCertificationsResponse;
}(ModelCommon_1.PaginatedResults));
exports.ListCertificationsResponse = ListCertificationsResponse;
//# sourceMappingURL=certifications.js.map