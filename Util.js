"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Util = void 0;
class Util {
    static generateToken(length, collection) {
        let found = false;
        let token = "";
        while (!found) {
            token = Util.generateRandomString(length);
            if (collection == null || (collection != null && !collection.has(token))) {
                found = true;
            }
        }
        if (collection != null)
            collection.set(token, true);
        return token;
    }
    static generateRandomString(length) {
        let s = '';
        let randomchar = function () {
            let n = Math.floor(Math.random() * 62);
            if (n < 10)
                return n; //1-10
            if (n < 36)
                return String.fromCharCode(n + 55); //A-Z
            return String.fromCharCode(n + 61); //a-z
        };
        while (s.length < length)
            s += randomchar();
        return s;
    }
    static getTimestamp() {
        return new Date().getTime();
    }
    static now() {
        return Util.formatDateTime();
    }
    static formatDateTime(date = null) {
        let input = new Date(date);
        return "" + (input.getFullYear()) + "-" +
            Util.pad(input.getMonth() + 1, 2, '0') + "-" +
            Util.pad(input.getDate(), 2, '0') + " " +
            Util.pad(input.getHours(), 2, '0') + ":" +
            Util.pad(input.getMinutes(), 2, '0') + ":" +
            Util.pad(input.getSeconds(), 2, '0');
    }
    static pad(input, width, padding) {
        padding = padding || '0';
        input = input + '';
        return input.length >= width ? input :
            new Array(width - input.length + 1).join(padding) + input;
    }
    static getTimeDiff(ts, unit) {
        let now = Util.getTimestamp();
        if (ts == null || now == null || ts <= 0 || now <= 0)
            return 0;
        let lastDate = new Date(ts).getTime();
        let nowDate = new Date(now).getTime();
        let diff = nowDate - lastDate;
        switch (unit) {
            case "milliseconds":
            case "millisecond":
            case "ms":
                return diff;
            case "sec":
            case "s":
            case "second":
            case "seconds":
                return diff / 1000;
            case "min":
            case "m":
            case "minutes":
            case "minute":
                return diff / 1000 / 60;
            case "hour":
            case "h":
            case "hours":
                return diff / 1000 / 60 / 60;
            case "days":
            case "day":
            case "d":
                return diff / 1000 / 60 / 60 / 24;
        }
        return 0;
    }
    static timeStart() {
        return process.hrtime();
    }
    static timeEnd(start) {
        return (process.hrtime(start)[1] / 1000000000).toFixed(5);
    }
    static isPlainObject(o) {
        let ctor, prot;
        if (Util._isObjectObject(o) === false)
            return false;
        // If has modified constructor
        ctor = o.constructor;
        if (typeof ctor !== 'function')
            return false;
        // If has modified prototype
        prot = ctor.prototype;
        if (Util._isObjectObject(prot) === false)
            return false;
        // If constructor does not have an Object-specific method
        if (prot.hasOwnProperty('isPrototypeOf') === false) {
            return false;
        }
        // Most likely a plain Object
        return true;
    }
    static _isObjectObject(o) {
        return Util.isObject(o) === true
            && Object.prototype.toString.call(o) === '[object Object]';
    }
    static isObject(val) {
        return val != null && typeof val === 'object' && Array.isArray(val) === false;
    }
    static isNumeric(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
}
exports.Util = Util;
//# sourceMappingURL=Util.js.map