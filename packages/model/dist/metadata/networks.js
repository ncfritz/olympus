"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateNetworkResponse = exports.CreateNetworkRequest = exports.PartialNetworkImage = exports.NetworkImage = exports.PartialNetworkAlternativeName = exports.NetworkAlternativeName = exports.PartialNetwork = exports.Network = exports.BaseNetwork = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var BaseNetwork = /** @class */ (function () {
    function BaseNetwork() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseNetwork.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseNetwork.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseNetwork.prototype, "headquarters", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseNetwork.prototype, "homepage", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseNetwork.prototype, "logoPath", void 0);
    return BaseNetwork;
}());
exports.BaseNetwork = BaseNetwork;
var Network = /** @class */ (function (_super) {
    tslib_1.__extends(Network, _super);
    function Network() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Network.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Network.prototype, "lastUpdatedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return NetworkAlternativeName; },
            isArray: true,
        })
    ], Network.prototype, "alternativeNames", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return NetworkImage; }, isArray: true })
    ], Network.prototype, "logos", void 0);
    return Network;
}(BaseNetwork));
exports.Network = Network;
var PartialNetwork = /** @class */ (function (_super) {
    tslib_1.__extends(PartialNetwork, _super);
    function PartialNetwork() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialNetwork.prototype, "originCountry", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialNetworkAlternativeName; },
            isArray: true,
        })
    ], PartialNetwork.prototype, "alternativeNames", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return PartialNetworkImage; }, isArray: true })
    ], PartialNetwork.prototype, "logos", void 0);
    return PartialNetwork;
}(BaseNetwork));
exports.PartialNetwork = PartialNetwork;
var NetworkAlternativeName = /** @class */ (function () {
    function NetworkAlternativeName() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], NetworkAlternativeName.prototype, "networkId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], NetworkAlternativeName.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], NetworkAlternativeName.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], NetworkAlternativeName.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], NetworkAlternativeName.prototype, "lastUpdatedTime", void 0);
    return NetworkAlternativeName;
}());
exports.NetworkAlternativeName = NetworkAlternativeName;
var PartialNetworkAlternativeName = /** @class */ (function (_super) {
    tslib_1.__extends(PartialNetworkAlternativeName, _super);
    function PartialNetworkAlternativeName() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialNetworkAlternativeName;
}((0, swagger_1.OmitType)(NetworkAlternativeName, ["createdTime", "lastUpdatedTime"])));
exports.PartialNetworkAlternativeName = PartialNetworkAlternativeName;
var NetworkImage = /** @class */ (function () {
    function NetworkImage() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], NetworkImage.prototype, "networkId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], NetworkImage.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], NetworkImage.prototype, "filePath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], NetworkImage.prototype, "fileType", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], NetworkImage.prototype, "width", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], NetworkImage.prototype, "height", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], NetworkImage.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], NetworkImage.prototype, "lastUpdatedTime", void 0);
    return NetworkImage;
}());
exports.NetworkImage = NetworkImage;
var PartialNetworkImage = /** @class */ (function (_super) {
    tslib_1.__extends(PartialNetworkImage, _super);
    function PartialNetworkImage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialNetworkImage;
}((0, swagger_1.OmitType)(NetworkImage, [
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialNetworkImage = PartialNetworkImage;
var CreateNetworkRequest = /** @class */ (function () {
    function CreateNetworkRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialNetwork; },
        })
    ], CreateNetworkRequest.prototype, "network", void 0);
    return CreateNetworkRequest;
}());
exports.CreateNetworkRequest = CreateNetworkRequest;
var CreateNetworkResponse = /** @class */ (function () {
    function CreateNetworkResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Network; },
        })
    ], CreateNetworkResponse.prototype, "network", void 0);
    return CreateNetworkResponse;
}());
exports.CreateNetworkResponse = CreateNetworkResponse;
//# sourceMappingURL=networks.js.map