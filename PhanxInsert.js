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
class PhanxInsert {
    /**
     * @param {PhanxMysql} db - db reference
     * @param {string} table - table name
     * @param {any} row (optional) - object of key/value column name/values.
     */
    constructor(db, table, row = null) {
        this.valuesToSave = [];
        this.db = db;
        this.table = table;
        if (row != null)
            this.row(row);
    }
    /**
     * Add a column/value to the current row.
     * @param {string} column - column name
     * @param value - value to insert
     * @returns {PhanxInsert}
     */
    s(column, value) {
        if (this.valuesToSave.length == 0)
            this.createNewValueRow();
        this.valuesToSave[column] = value;
        return this;
    }
    /**
     * Adds a new row to the insert.
     * @param obj - key/value pairs
     * @returns {PhanxInsert}
     */
    row(obj) {
        this.valuesToSave.push(obj);
        return this;
    }
    /**
     * Creates a new row. To be used to the s(...) method.
     * @returns {PhanxInsert}
     */
    newRow() {
        this.createNewValueRow();
        return this;
    }
    /**
     * Finalizes the insert query and executes it.
     * @returns {Promise<any>}
     */
    finalize() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.valuesToSave == null || this.valuesToSave.length == 0) {
                throw new Error("No rows were provided to be inserted.");
            }
            let params = [];
            let firstRow = this.valuesToSave[0];
            let firstRowKeys = Object.keys(firstRow);
            let sql = "insert into " + this.table + " ";
            sql += "(" + firstRowKeys.join(",") + ") VALUES ";
            let questionMarkTemplate = firstRowKeys.map(x => "?").join(",");
            for (let row of this.valuesToSave) {
                if (row == null)
                    continue;
                //place question marks
                sql += "(" + questionMarkTemplate + "),";
                for (let key in row) {
                    let value = row[key];
                    params.push(value);
                }
            }
            //remove last comma if there is one
            if (sql.substr(sql.length - 1) == ",")
                sql = sql.substr(0, sql.length - 1);
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
    createNewValueRow() {
        this.valuesToSave.push({});
    }
}
exports.PhanxInsert = PhanxInsert;
//# sourceMappingURL=PhanxInsert.js.map