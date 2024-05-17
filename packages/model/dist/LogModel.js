"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLine = exports.LogLevel = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var LogLevel;
(function (LogLevel) {
    LogLevel["TRACE"] = "TRACE";
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["FATAL"] = "FATAL";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var LogLine = /** @class */ (function () {
    function LogLine() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], LogLine.prototype, "timestamp", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            enum: function () { return LogLevel; },
            enumName: "LogLevel",
        })
    ], LogLine.prototype, "level", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], LogLine.prototype, "data", void 0);
    return LogLine;
}());
exports.LogLine = LogLine;
//# sourceMappingURL=LogModel.js.map