"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginatedResults = exports.EmptyResponse = exports.SortDirection = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var SortDirection;
(function (SortDirection) {
    SortDirection["ASC"] = "asc";
    SortDirection["DESC"] = "desc";
})(SortDirection || (exports.SortDirection = SortDirection = {}));
var EmptyResponse = /** @class */ (function () {
    function EmptyResponse() {
    }
    return EmptyResponse;
}());
exports.EmptyResponse = EmptyResponse;
var PaginatedResults = /** @class */ (function () {
    function PaginatedResults() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PaginatedResults.prototype, "count", void 0);
    return PaginatedResults;
}());
exports.PaginatedResults = PaginatedResults;
//# sourceMappingURL=ModelCommon.js.map