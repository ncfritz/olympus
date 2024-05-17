"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetSummaryResponse = exports.ListNotesResponse = exports.SingleNoteResponse = exports.UpdateNoteRequest = exports.CreateNoteRequest = exports.NoteTypeCounts = exports.Note = exports.PartialNote = exports.BaseNoteWithAssociations = exports.BaseNote = exports.PartialNoteAssociation = exports.NoteAssociation = exports.NoteType = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var NoteType;
(function (NoteType) {
})(NoteType || (exports.NoteType = NoteType = {}));
var NoteAssociation = /** @class */ (function () {
    function NoteAssociation() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], NoteAssociation.prototype, "itemId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], NoteAssociation.prototype, "itemType", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], NoteAssociation.prototype, "createdTime", void 0);
    return NoteAssociation;
}());
exports.NoteAssociation = NoteAssociation;
var PartialNoteAssociation = /** @class */ (function (_super) {
    tslib_1.__extends(PartialNoteAssociation, _super);
    function PartialNoteAssociation() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialNoteAssociation;
}((0, swagger_1.PartialType)((0, swagger_1.OmitType)(NoteAssociation, ["createdTime"]))));
exports.PartialNoteAssociation = PartialNoteAssociation;
var BaseNote = /** @class */ (function () {
    function BaseNote() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseNote.prototype, "author", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BaseNote.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Boolean })
    ], BaseNote.prototype, "flagged", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseNote.prototype, "title", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseNote.prototype, "summary", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BaseNote.prototype, "value", void 0);
    return BaseNote;
}());
exports.BaseNote = BaseNote;
var BaseNoteWithAssociations = /** @class */ (function (_super) {
    tslib_1.__extends(BaseNoteWithAssociations, _super);
    function BaseNoteWithAssociations() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: NoteAssociation, isArray: true })
    ], BaseNoteWithAssociations.prototype, "associations", void 0);
    return BaseNoteWithAssociations;
}(BaseNote));
exports.BaseNoteWithAssociations = BaseNoteWithAssociations;
var PartialNote = /** @class */ (function (_super) {
    tslib_1.__extends(PartialNote, _super);
    function PartialNote() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialNote;
}((0, swagger_1.PartialType)((0, swagger_1.OmitType)(BaseNoteWithAssociations, ["author"]))));
exports.PartialNote = PartialNote;
var Note = /** @class */ (function (_super) {
    tslib_1.__extends(Note, _super);
    function Note() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], Note.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Note.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Note.prototype, "lastUpdatedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Note.prototype, "deletedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: NoteAssociation, isArray: true })
    ], Note.prototype, "associations", void 0);
    return Note;
}(BaseNote));
exports.Note = Note;
var NoteTypeCounts = /** @class */ (function () {
    function NoteTypeCounts() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], NoteTypeCounts.prototype, "note", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], NoteTypeCounts.prototype, "idea", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], NoteTypeCounts.prototype, "thought", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], NoteTypeCounts.prototype, "action", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], NoteTypeCounts.prototype, "question", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], NoteTypeCounts.prototype, "praise", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], NoteTypeCounts.prototype, "total", void 0);
    return NoteTypeCounts;
}());
exports.NoteTypeCounts = NoteTypeCounts;
var CreateNoteRequest = /** @class */ (function () {
    function CreateNoteRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return BaseNoteWithAssociations; },
        })
    ], CreateNoteRequest.prototype, "note", void 0);
    return CreateNoteRequest;
}());
exports.CreateNoteRequest = CreateNoteRequest;
var UpdateNoteRequest = /** @class */ (function () {
    function UpdateNoteRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialNote; },
        })
    ], UpdateNoteRequest.prototype, "note", void 0);
    return UpdateNoteRequest;
}());
exports.UpdateNoteRequest = UpdateNoteRequest;
var SingleNoteResponse = /** @class */ (function () {
    function SingleNoteResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return BaseNote; },
        })
    ], SingleNoteResponse.prototype, "note", void 0);
    return SingleNoteResponse;
}());
exports.SingleNoteResponse = SingleNoteResponse;
var ListNotesResponse = /** @class */ (function () {
    function ListNotesResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Note; },
            isArray: true,
        })
    ], ListNotesResponse.prototype, "notes", void 0);
    return ListNotesResponse;
}());
exports.ListNotesResponse = ListNotesResponse;
var GetSummaryResponse = /** @class */ (function () {
    function GetSummaryResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return NoteTypeCounts; },
        })
    ], GetSummaryResponse.prototype, "counts", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return NoteTypeCounts; },
        })
    ], GetSummaryResponse.prototype, "hourly", void 0);
    return GetSummaryResponse;
}());
exports.GetSummaryResponse = GetSummaryResponse;
//# sourceMappingURL=notes.js.map