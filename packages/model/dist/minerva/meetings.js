"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetMeetingStatusStatisticsResponse = exports.GetMeetingSummaryStatisticsResponse = exports.ListCalendarItemsResponse = exports.SingleCalendarItemResponse = exports.CreateCalendarItemRequest = exports.MeetingAttendee = exports.MeetingStatusStatistics = exports.MeetingUser = exports.Meeting = exports.MeetingStatus = exports.MeetingOccurrenceType = exports.MeetingImportance = exports.MeetingSensitivity = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var MeetingSensitivity;
(function (MeetingSensitivity) {
    MeetingSensitivity["Normal"] = "Normal";
    MeetingSensitivity["Personal"] = "Personal";
    MeetingSensitivity["Private"] = "Private";
    MeetingSensitivity["Confidential"] = "Confidential";
})(MeetingSensitivity || (exports.MeetingSensitivity = MeetingSensitivity = {}));
var MeetingImportance;
(function (MeetingImportance) {
    MeetingImportance["Low"] = "Low";
    MeetingImportance["Normal"] = "Normal";
    MeetingImportance["High"] = "High";
})(MeetingImportance || (exports.MeetingImportance = MeetingImportance = {}));
var MeetingOccurrenceType;
(function (MeetingOccurrenceType) {
    MeetingOccurrenceType["Single"] = "Single";
    MeetingOccurrenceType["Occurrence"] = "Occurrence";
    MeetingOccurrenceType["Exception"] = "Exception";
    MeetingOccurrenceType["RecurringMaster"] = "RecurringMaster";
})(MeetingOccurrenceType || (exports.MeetingOccurrenceType = MeetingOccurrenceType = {}));
var MeetingStatus;
(function (MeetingStatus) {
    MeetingStatus["Free"] = "Free";
    MeetingStatus["Tentative"] = "Tentative";
    MeetingStatus["Busy"] = "Busy";
    MeetingStatus["OOF"] = "OOF";
    MeetingStatus["WorkingElsewhere"] = "WorkingElsewhere";
    MeetingStatus["NoData"] = "NoData";
})(MeetingStatus || (exports.MeetingStatus = MeetingStatus = {}));
var Meeting = /** @class */ (function () {
    function Meeting() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Meeting.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Meeting.prototype, "subject", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: MeetingSensitivity })
    ], Meeting.prototype, "sensitivity", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: MeetingImportance })
    ], Meeting.prototype, "importance", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: MeetingOccurrenceType })
    ], Meeting.prototype, "occurrenceType", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Meeting.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Meeting.prototype, "reminder", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Meeting.prototype, "response", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Meeting.prototype, "startTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Meeting.prototype, "endTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], Meeting.prototype, "duration", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Boolean })
    ], Meeting.prototype, "isAllDay", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: MeetingStatus })
    ], Meeting.prototype, "status", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Meeting.prototype, "location", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Boolean })
    ], Meeting.prototype, "isCancelled", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return MeetingUser; } })
    ], Meeting.prototype, "organizer", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return MeetingAttendee; }, isArray: true })
    ], Meeting.prototype, "attendees", void 0);
    return Meeting;
}());
exports.Meeting = Meeting;
var MeetingUser = /** @class */ (function () {
    function MeetingUser() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MeetingUser.prototype, "email", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MeetingUser.prototype, "alias", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MeetingUser.prototype, "givenName", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MeetingUser.prototype, "surname", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MeetingUser.prototype, "type", void 0);
    return MeetingUser;
}());
exports.MeetingUser = MeetingUser;
var MeetingTimeStatistic = /** @class */ (function () {
    function MeetingTimeStatistic() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], MeetingTimeStatistic.prototype, "totalDurationMin", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], MeetingTimeStatistic.prototype, "count", void 0);
    return MeetingTimeStatistic;
}());
var MeetingStatusStatistics = /** @class */ (function () {
    function MeetingStatusStatistics() {
    }
    var _a, _b, _c, _d, _e, _f;
    _a = MeetingStatus.Free, _b = MeetingStatus.Busy, _c = MeetingStatus.Tentative, _d = MeetingStatus.OOF, _e = MeetingStatus.NoData, _f = MeetingStatus.WorkingElsewhere;
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MeetingTimeStatistic; },
        })
    ], MeetingStatusStatistics.prototype, _a, void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MeetingTimeStatistic; },
        })
    ], MeetingStatusStatistics.prototype, _b, void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MeetingTimeStatistic; },
        })
    ], MeetingStatusStatistics.prototype, _c, void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MeetingTimeStatistic; },
        })
    ], MeetingStatusStatistics.prototype, _d, void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MeetingTimeStatistic; },
        })
    ], MeetingStatusStatistics.prototype, _e, void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MeetingTimeStatistic; },
        })
    ], MeetingStatusStatistics.prototype, _f, void 0);
    return MeetingStatusStatistics;
}());
exports.MeetingStatusStatistics = MeetingStatusStatistics;
var MeetingAttendee = /** @class */ (function (_super) {
    tslib_1.__extends(MeetingAttendee, _super);
    function MeetingAttendee() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MeetingAttendee.prototype, "attendance", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], MeetingAttendee.prototype, "response", void 0);
    return MeetingAttendee;
}(MeetingUser));
exports.MeetingAttendee = MeetingAttendee;
var CreateCalendarItemRequest = /** @class */ (function () {
    function CreateCalendarItemRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Meeting; },
        })
    ], CreateCalendarItemRequest.prototype, "item", void 0);
    return CreateCalendarItemRequest;
}());
exports.CreateCalendarItemRequest = CreateCalendarItemRequest;
var SingleCalendarItemResponse = /** @class */ (function () {
    function SingleCalendarItemResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Meeting; },
        })
    ], SingleCalendarItemResponse.prototype, "item", void 0);
    return SingleCalendarItemResponse;
}());
exports.SingleCalendarItemResponse = SingleCalendarItemResponse;
var ListCalendarItemsResponse = /** @class */ (function () {
    function ListCalendarItemsResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Meeting; },
            isArray: true,
        })
    ], ListCalendarItemsResponse.prototype, "items", void 0);
    return ListCalendarItemsResponse;
}());
exports.ListCalendarItemsResponse = ListCalendarItemsResponse;
var GetMeetingSummaryStatisticsResponse = /** @class */ (function () {
    function GetMeetingSummaryStatisticsResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MeetingStatusStatistics; },
        })
    ], GetMeetingSummaryStatisticsResponse.prototype, "hourOfDayStatistics", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MeetingStatusStatistics; },
        })
    ], GetMeetingSummaryStatisticsResponse.prototype, "dayOfWeekStatistics", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MeetingStatusStatistics; },
        })
    ], GetMeetingSummaryStatisticsResponse.prototype, "statusStatistics", void 0);
    return GetMeetingSummaryStatisticsResponse;
}());
exports.GetMeetingSummaryStatisticsResponse = GetMeetingSummaryStatisticsResponse;
var GetMeetingStatusStatisticsResponse = /** @class */ (function () {
    function GetMeetingStatusStatisticsResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return MeetingStatusStatistics; },
        })
    ], GetMeetingStatusStatisticsResponse.prototype, "statusStatistics", void 0);
    return GetMeetingStatusStatisticsResponse;
}());
exports.GetMeetingStatusStatisticsResponse = GetMeetingStatusStatisticsResponse;
//# sourceMappingURL=meetings.js.map