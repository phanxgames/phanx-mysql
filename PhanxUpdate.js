"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
class PhanxUpdate {
    /**
     * @param {PhanxMysql} db - db reference
     * @param {string} table - table name
     * @param {any|string} where - the where clause:
     *                          as string for sql, or
     *                          column/value pair object for strict equals
     * @param {Array<any>} whereParams (optional) used with where as string
     *                              to replace the ? params you may use.
     * @param {any} values (optional) - column/value pair object to set values
     */
    constructor(db, table, where, whereParams = null, values = null) {
        this.valuesToSave = {};
        this.db = db;
        this.table = table;
        this.where = where;
        this.whereParams = whereParams;
        if (values != null)
            this.row(values);
    }
    /**
     * Add a column/value to the current row.
     * @param {string} column - column name
     * @param value - value to insert
     * @returns {PhanxUpdate}
     */
    s(column, value) {
        this.valuesToSave[column] = value;
        return this;
    }
    /**
     * Adds a new row to the insert.
     * @param obj - key/value pairs
     * @returns {PhanxInsert}
     */
    values(obj) {
        this.valuesToSave = obj;
        return this;
    }
    /**
     * @alias values
     */
    row(obj) {
        return this.values(obj);
    }
    /**
     * Finalizes the insert query and executes it.
     * @returns {Promise<any>}
     */
    finalize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.valuesToSave == null) {
                throw new Error("No values were provided to be updated.");
            }
            let params = [];
            let sql = "update " + this.table + " set ";
            for (let key in this.valuesToSave) {
                sql += key + "=? ,";
                params.push(this.valuesToSave[key]);
            }
            //remove last comma if there is one
            if (sql.substr(sql.length - 1) == ",")
                sql = sql.substr(0, sql.length - 1);
            //where clause
            if (this.where != null && this.where != "") {
                if (typeof (this.where) == "string") {
                    sql += " where " + this.where;
                    if (this.whereParams != null)
                        params = params.concat(this.whereParams);
                }
                else {
                    sql += " where ";
                    for (let key in this.where) {
                        sql += key + "=?,";
                        params.push(this.where[key]);
                    }
                    if (sql.substr(sql.length - 1) == ",")
                        sql = sql.substr(0, sql.length - 1);
                }
            }
            yield this.db.query(sql, params);
        });
    }
    /**
     * @alias finalize
     * @returns {Promise<any>}
     */
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.finalize();
        });
    }
    /**
     * @alias finalize
     * @returns {Promise<any>}
     */
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.finalize();
        });
    }
}
exports.PhanxUpdate = PhanxUpdate;
//# sourceMappingURL=PhanxUpdate.js.map