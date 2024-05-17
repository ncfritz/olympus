"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePersonResponse = exports.CreatePersonRequest = exports.PartialPersonImage = exports.PersonImage = exports.PartialPersonAlsoKnownAs = exports.PersonAlsoKnownAs = exports.PartialPersonExternalId = exports.PersonExternalId = exports.PartialPerson = exports.Person = exports.BasePerson = exports.Gender = void 0;
var tslib_1 = require("tslib");
var swagger_1 = require("@nestjs/swagger");
var class_transformer_1 = require("class-transformer");
var countries_1 = require("./countries");
var Gender;
(function (Gender) {
    Gender[Gender["UNKNOWN"] = 0] = "UNKNOWN";
    Gender[Gender["FEMALE"] = 1] = "FEMALE";
    Gender[Gender["MALE"] = 2] = "MALE";
    Gender[Gender["NON_BINARY"] = 3] = "NON_BINARY";
})(Gender || (exports.Gender = Gender = {}));
var BasePerson = /** @class */ (function () {
    function BasePerson() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], BasePerson.prototype, "id", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BasePerson.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Boolean })
    ], BasePerson.prototype, "adult", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BasePerson.prototype, "biography", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BasePerson.prototype, "birthday", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BasePerson.prototype, "birthplace", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BasePerson.prototype, "deathday", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ enum: Gender })
    ], BasePerson.prototype, "gender", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BasePerson.prototype, "homepage", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BasePerson.prototype, "imdbId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BasePerson.prototype, "knownForDepartment", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], BasePerson.prototype, "profilePath", void 0);
    return BasePerson;
}());
exports.BasePerson = BasePerson;
var Person = /** @class */ (function (_super) {
    tslib_1.__extends(Person, _super);
    function Person() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Person.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], Person.prototype, "lastUpdatedTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PersonExternalId; },
            isArray: true,
        })
    ], Person.prototype, "externalIds", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PersonAlsoKnownAs; },
            isArray: true,
        })
    ], Person.prototype, "alsoKnownAs", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return PersonImage; }, isArray: true })
    ], Person.prototype, "images", void 0);
    return Person;
}(BasePerson));
exports.Person = Person;
var PartialPerson = /** @class */ (function (_super) {
    tslib_1.__extends(PartialPerson, _super);
    function PartialPerson() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialPersonExternalId; },
            isArray: true,
        })
    ], PartialPerson.prototype, "externalIds", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialPersonAlsoKnownAs; },
            isArray: true,
        })
    ], PartialPerson.prototype, "alsoKnownAs", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: function () { return PartialPersonImage; }, isArray: true })
    ], PartialPerson.prototype, "images", void 0);
    return PartialPerson;
}(BasePerson));
exports.PartialPerson = PartialPerson;
var PersonExternalId = /** @class */ (function () {
    function PersonExternalId() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PersonExternalId.prototype, "type", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PersonExternalId.prototype, "externalId", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], PersonExternalId.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], PersonExternalId.prototype, "lastUpdatedTime", void 0);
    return PersonExternalId;
}());
exports.PersonExternalId = PersonExternalId;
var PartialPersonExternalId = /** @class */ (function (_super) {
    tslib_1.__extends(PartialPersonExternalId, _super);
    function PartialPersonExternalId() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialPersonExternalId;
}((0, swagger_1.OmitType)(PersonExternalId, [
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialPersonExternalId = PartialPersonExternalId;
var PersonAlsoKnownAs = /** @class */ (function () {
    function PersonAlsoKnownAs() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PersonAlsoKnownAs.prototype, "name", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], PersonAlsoKnownAs.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], PersonAlsoKnownAs.prototype, "lastUpdatedTime", void 0);
    return PersonAlsoKnownAs;
}());
exports.PersonAlsoKnownAs = PersonAlsoKnownAs;
var PartialPersonAlsoKnownAs = /** @class */ (function (_super) {
    tslib_1.__extends(PartialPersonAlsoKnownAs, _super);
    function PartialPersonAlsoKnownAs() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return PartialPersonAlsoKnownAs;
}((0, swagger_1.OmitType)(PersonAlsoKnownAs, [
    "createdTime",
    "lastUpdatedTime",
])));
exports.PartialPersonAlsoKnownAs = PartialPersonAlsoKnownAs;
var PersonImage = /** @class */ (function () {
    function PersonImage() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PersonImage.prototype, "filePath", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PersonImage.prototype, "width", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: Number })
    ], PersonImage.prototype, "height", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: countries_1.Country })
    ], PersonImage.prototype, "country", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], PersonImage.prototype, "createdTime", void 0);
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String }),
        (0, class_transformer_1.Transform)(function (_a) {
            var value = _a.value;
            return value.toISOString();
        })
    ], PersonImage.prototype, "lastUpdatedTime", void 0);
    return PersonImage;
}());
exports.PersonImage = PersonImage;
var PartialPersonImage = /** @class */ (function (_super) {
    tslib_1.__extends(PartialPersonImage, _super);
    function PartialPersonImage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({ type: String })
    ], PartialPersonImage.prototype, "countryCode", void 0);
    return PartialPersonImage;
}((0, swagger_1.OmitType)(PersonImage, [
    "createdTime",
    "lastUpdatedTime",
    "country",
])));
exports.PartialPersonImage = PartialPersonImage;
var CreatePersonRequest = /** @class */ (function () {
    function CreatePersonRequest() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return PartialPerson; },
        })
    ], CreatePersonRequest.prototype, "person", void 0);
    return CreatePersonRequest;
}());
exports.CreatePersonRequest = CreatePersonRequest;
var CreatePersonResponse = /** @class */ (function () {
    function CreatePersonResponse() {
    }
    tslib_1.__decorate([
        (0, swagger_1.ApiProperty)({
            type: function () { return Person; },
        })
    ], CreatePersonResponse.prototype, "person", void 0);
    return CreatePersonResponse;
}());
exports.CreatePersonResponse = CreatePersonResponse;
//# sourceMappingURL=people.js.map