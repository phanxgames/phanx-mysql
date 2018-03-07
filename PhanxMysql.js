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
const dictionaryjs_1 = require("dictionaryjs");
const Mysql = require("mysql");
const Util_1 = require("./Util");
class PhanxMysql {
    constructor(config = null) {
        //references
        this._config = null;
        this._client = null;
        //data set
        this._startStack = null;
        this._errorStack = null;
        this._result = [];
        this._resultCount = 0;
        this._errorLast = null;
        this.cursor = 0;
        //properties
        this._opened = false;
        this._openedTimestamp = 0;
        this._guid = null;
        this._throwErrors = true;
        /**
         * @ignore
         * @internal
         */
        this[Symbol.iterator] = function* () {
            for (let row of this._result) {
                yield row;
            }
        };
        this.config = config;
        PhanxMysql.setAutoCloseMinutes(PhanxMysql.auto_closer_minutes);
    }
    //#########################################################
    // Static Methods
    //#########################################################
    static set config(config) {
        PhanxMysql.dbConfig = config;
        PhanxMysql.setAutoCloseMinutes(config.autoCloseMinutes);
    }
    static createAndStart() {
        return __awaiter(this, void 0, void 0, function* () {
            let db = new PhanxMysql();
            yield db.start();
            return db;
        });
    }
    static closeAll(cb = null) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let conn of PhanxMysql.openConnections) {
                if (conn != null)
                    yield conn.close();
            }
            if (cb != null)
                cb();
        });
    }
    static closePool(cb = null) {
        return new Promise((resolve, reject) => {
            let pool = PhanxMysql.pool;
            if (pool != null) {
                pool.end((err) => {
                    console.log("pool closed");
                    console.error(err);
                    if (cb != null)
                        cb(err);
                    else {
                        if (err != null) {
                            reject(err);
                        }
                        else
                            resolve();
                    }
                });
            }
        });
    }
    static setAutoCloseMinutes(minutes) {
        if (PhanxMysql.auto_closer_interval != null)
            clearInterval(PhanxMysql.auto_closer_interval);
        PhanxMysql.auto_closer_minutes = minutes;
        let enabled = (minutes > 0);
        if (enabled) {
            PhanxMysql.auto_closer_interval = setInterval(() => {
                let outlog = "";
                let counter = 0;
                for (let db of PhanxMysql.openConnections) {
                    counter++;
                    if (db.opened) {
                        let minutes = Util_1.Util.getTimeDiff(db.openedTime, "min");
                        if (minutes > PhanxMysql.auto_closer_minutes) {
                            outlog += "\n[" + db.guid + "] Db Opened : " + minutes +
                                " minutes\n" + db.startStack + "\n";
                            //auto closer
                            db.end();
                        }
                    }
                }
                if (outlog != "") {
                    console.error("----------------------------------------\n" +
                        "**** " + counter +
                        " Database Connection Auto-Closed ****" + outlog +
                        "\n----------------------------------------");
                }
                else if (counter > 0) {
                    console.log("Database connections still opened (" + counter + ").");
                }
            }, 10000);
        }
    }
    //#########################################################
    // Config Methods
    //#########################################################
    get throwErrors() {
        return this._throwErrors;
    }
    set throwErrors(value) {
        this._throwErrors = value;
    }
    set config(config) {
        this._config = config;
    }
    get config() {
        if (this._config == null) {
            return PhanxMysql.dbConfig;
        }
        return this._config;
    }
    usePool() {
        return (this.config.usePool == true);
    }
    //#########################################################
    // Open/Close Methods
    //#########################################################
    /**
     * Opens database connection.
     *
     * @param {Function} cb - (optional) cb(err:any=null)
     * @returns {Promise<null>}
     */
    start(cb = null) {
        this._startStack = this._errorStack = new Error().stack;
        return new Promise((resolve, reject) => {
            try {
                if (this.usePool()) {
                    if (PhanxMysql.pool == null)
                        PhanxMysql.pool = Mysql.createPool(this.config.mysql);
                    PhanxMysql.pool.getConnection((err, conn) => {
                        if (err) {
                            console.error("Problem getting database connection from pool:\n", this._errorStack, "\n", err);
                            this.handleCallback(cb, resolve, reject, err);
                            return;
                        }
                        this.generateGuid();
                        this._openedTimestamp = Util_1.Util.getTimestamp();
                        this._opened = true;
                        this._client = conn;
                        PhanxMysql.openConnections.set(this._guid, this);
                        this.handleCallback(cb, resolve);
                    });
                }
                else {
                    //non pool connection
                    if (this._opened) {
                        let err = new Error("Database connection already open.");
                        console.error(err);
                        this.handleCallback(cb, resolve, reject, err);
                        return;
                    }
                    let connection = Mysql.createConnection(this.config.mysql);
                    connection.connect((err) => {
                        if (err) {
                            console.error("Problem getting database connection:\n", this._errorStack, "\n", err);
                            this.handleCallback(cb, resolve, reject, err);
                            return;
                        }
                        this.generateGuid();
                        this._opened = true;
                        this._openedTimestamp = Util_1.Util.getTimestamp();
                        this._client = connection;
                        PhanxMysql.openConnections.set(this._guid, this);
                        this.handleCallback(cb, resolve);
                    });
                }
            }
            catch (err) {
                console.error("Problem getting database connection:\n", this._errorStack, "\n", err);
                this.handleCallback(cb, resolve, reject, err);
            }
        });
    }
    /**
     * @alias start(...)
     */
    open(cb = null) {
        return this.start(cb);
    }
    /**
     * Closes database connection.
     *
     * @param {Function} cb - (optional) cb()
     * @returns {Promise<null>}
     */
    end(cb = null) {
        return new Promise((resolve) => {
            if (!this._opened) {
                console.error("Database connection is already closed.");
                return;
            }
            if (this._openedTimestamp > 0) {
                let elapsed = Util_1.Util.getTimeDiff(this._openedTimestamp, "ms");
                console.log("Connection released after in use for " + elapsed + " ms.");
            }
            if (this._client == null) {
                this.handleCallback(cb, resolve);
                return;
            }
            if (this.usePool()) {
                this._client.release();
                PhanxMysql.openConnections.remove(this._guid);
                this._client = null;
                this._openedTimestamp = 0;
                this._opened = false;
                this._errorStack = null;
                this._startStack = null;
                this._result = [];
                this._resultCount = 0;
                this.handleCallback(cb, resolve);
            }
            else {
                this._client.end((err) => {
                    if (err) {
                        console.error("Error closing connection", err);
                    }
                    PhanxMysql.openConnections.remove(this._guid);
                    this._client = null;
                    this._openedTimestamp = 0;
                    this._opened = false;
                    this._errorStack = null;
                    this._startStack = null;
                    this._result = [];
                    this._resultCount = 0;
                    this.handleCallback(cb, resolve);
                });
            }
        });
    }
    /**
     * @alias end(...)
     */
    close(cb = null) {
        return this.end(cb);
    }
    //##############################################
    // query method
    //##############################################
    /**
     * Query the database.
     *
     * @param {string} sql
     * @param {number|string|Array<any>} paras - (optional)
     * @param {Function} cb - (optional) cb(err:any,result:Array<any>,cbResume?:Function)
     * @returns {Promise<any>} - result:Array<any>
     */
    query(sql, paras = null, cb = null) {
        this._errorStack = new Error().stack;
        return new Promise((resolve, reject) => {
            this._resultCount = 0;
            this._result = [];
            if (this._client == null) {
                let err = new Error("Database Connection is not open.");
                console.error(err);
                this.handleCallback(cb, resolve, reject, err, null, () => {
                    resolve(null);
                });
                return;
            }
            let timeStart = Util_1.Util.timeStart();
            if (!Array.isArray(paras))
                paras = [paras];
            this._client.query(sql, paras, (err, result) => {
                let elapsed = Util_1.Util.timeEnd(timeStart);
                if (err || result == null) {
                    let errObj = {
                        stack: this._errorStack,
                        sql: sql,
                        paras: paras,
                        message: "Unspecified Database Query Error."
                    };
                    if (err != null && err.hasOwnProperty("message")) {
                        errObj.message = err.message;
                    }
                    console.error("Database Error (" + elapsed + "s): ", errObj);
                    this.handleCallback(cb, resolve, reject, errObj, null, () => {
                        resolve(null);
                    });
                    return;
                }
                console.log("Query completed in " + elapsed + " seconds.");
                //result = result as Object;
                if (Array.isArray(result))
                    this._result = result;
                else
                    this._result = [result];
                this._resultCount = this._result.length;
                this.handleCallback(cb, resolve, reject, null, this._result, () => {
                    resolve(this._result);
                });
            });
        });
    }
    //#########################################################
    // Select Methods
    //#########################################################
    /**
     * Select the first row from query.
     *
     * @param {string} sql
     * @param {Array<any>} paras - (optional)
     * @param {Function} cb - (optional) cb(err:any,row:any,cbResume?:Function)
     * @returns {Promise<any>}
     */
    selectRow(sql, paras = null, cb = null) {
        return new Promise((resolve, reject) => {
            this.query(sql, paras, (err, result) => {
                if (err || result == null || result.length < 1) {
                    this.handleCallback(cb, resolve, reject, err, result, () => {
                        resolve(result);
                    });
                    return;
                }
                this.handleCallback(cb, resolve, reject, null, result[0], () => {
                    resolve(result[0]);
                });
            });
        });
    }
    /**
     * @ignore
     * @alias query(...)
     */
    selectArray(sql, paras = null, cb = null) {
        return this.query(sql, paras, cb);
    }
    //#########################################################
    // Insert/Update Helper Methods
    //#########################################################
    /**
     * Insert Helper Method.
     * Example:
     * Inserts a new record with id of 1 and name of test.
     * <pre>
     *     ...
     *     let insert:PhanxInsert = db.insert("test",{id:1,name:"test"});
     *     await insert.run();
     *     ...
     * </pre>
     *
     * @param {string} table - table name
     * @param {any} row (optional) - object of key/value column name/values.
     * @returns {PhanxInsert}
     */
    insert(table, values = null) {
        return new PhanxInsert(this, table, values);
    }
    /**
     * Update helper method.
     * Example:
     * Updates record id=15 changing name to "test":
     * <pre>
     *     ...
     *     let update:PhanxUpdate = db.update("test","id=?",[15],{name:"test"});
     *     await update.run();
     *     ...
     *     //another way to do the same:
     *     let update:PhanxUpdate = db.update("test",{id:15},null,{name:"test"});
     *     await update.run();
     *     ...
     * </pre>
     * @param {string} table - table name
     * @param {any|string} where - the where clause:
     *                          as string for sql, or
     *                          column/value pair object for strict equals
     * @param {Array<any>} whereParams (optional) used with where as string
     *                              to replace the ? params you may use.
     * @param {any} values (optional) - column/value pair object to set values
     * @returns {PhanxUpdate}
     */
    update(table, where, whereParams = null, values = null) {
        return new PhanxUpdate(this, table, where, whereParams, values);
    }
    /**
     * Calls insert and runs automatically.
     * Usage:
     * <pre>
     *     ...
     *     await db.insertAndRun("test",{name:"test"});
     *     ...
     * </pre>
     *
     * @param {string} table - table name
     * @param {any} row - object of key/value column name/values.
     * @returns {Promise<any>}
     */
    insertAndRun(table, values) {
        return (this.insert(table, values)).run();
    }
    /**
     * Calls update method and runs automatically.
     * Usage:
     * <pre>
     *     ...
     *     await db.updateAndRun("test",{id:1},null,{name:"test"});
     *     ...
     * </pre>
     *
     * @param {string} table - table name
     * @param {any|string} where - the where clause:
     *                          as string for sql, or
     *                          column/value pair object for strict equals
     * @param {Array<any>} whereParams (optional) used with where as string
     *                              to replace the ? params you may use.
     * @param {any} values (optional) - column/value pair object to set values
     * @returns {Promise<any>}
     */
    updateAndRun(table, where, whereParams = null, values = null) {
        return (this.update(table, where, whereParams, values)).run();
    }
    //#########################################################
    // Transaction Methods
    //#########################################################
    /**
     * Transaction Begin Helper method.
     *
     * @param {Function} cb - (optional) cb(err:any,result:any,cbResume?:Function)
     * @returns {Promise<any>}
     */
    begin(cb = null) {
        return this.query("START TRANSACTION;", null, cb);
    }
    /**
     * Transaction Commit Helper method.
     *
     * @param {Function} cb - (optional) cb(err:any,result:any,cbResume?:Function)
     * @returns {Promise<any>}
     */
    commit(cb = null) {
        return this.query("COMMIT;", null, cb);
    }
    /**
     * Transaction Rollback Helper method.
     *
     * @param {Function} cb - (optional) cb(err:any,result:any,cbResume?:Function)
     * @returns {Promise<any>}
     */
    rollback(cb = null) {
        return this.query("ROLLBACK;", null, cb);
    }
    //#########################################################
    // Instance Get Methods
    //#########################################################
    /**
     * Global Unique Identifier for this connection.
     * @returns {String}
     */
    get guid() {
        return this._guid;
    }
    /**
     * The stack trace for the start of this connection.
     * Useful to narrow down where this connection was created if left open.
     * @returns {String}
     */
    get startStack() {
        return this._startStack;
    }
    /**
     * Returns whether the connection is open or not.
     * @returns {Boolean}
     */
    get opened() {
        return this._opened;
    }
    /**
     * Timestamp of when connection was opened. Linux epoch.
     * @returns {number}
     */
    get openedTime() {
        return this._openedTimestamp;
    }
    /**
     * Returns if there was an error from the last operation or null if there wasn't.
     * @returns {any}
     */
    get error() {
        return this._errorLast;
    }
    //#########################################################
    // Result Methods
    //#########################################################
    /**
     * Returns array of rows from last query.
     * @returns {Array<any>}
     */
    get rows() {
        return this._result;
    }
    /**
     * Returns the number of rows from last query.
     * @returns {number}
     */
    get rowCount() {
        return this._resultCount;
    }
    /**
     * Returns the next row from the last query and moves the cursor to the next.
     * @returns {Object}
     */
    get row() {
        if (this.cursor >= this.rowCount)
            return null;
        let row = this._result[this.cursor];
        this.cursor++;
        return row;
    }
    hasRows() {
        return (this.cursor < this.rowCount);
    }
    /**
     * Async (non-blocking) loop through last query's rows.
     *
     * @param {Function} cbIterator
     * @param {Function} cbComplete
     * @returns {Promise<any>}
     */
    asyncForEach(cbIterator, cbComplete = null) {
        return new Promise((resolve) => {
            let counter = 0;
            let len = this.rowCount;
            let next = () => {
                if (counter < len) {
                    process.nextTick(step);
                    //setTimeout(step,100);
                }
                else {
                    if (cbComplete != null)
                        cbComplete();
                    else
                        resolve();
                    return;
                }
            };
            let step = () => {
                if (counter < len) {
                    if (cbIterator(counter, this._result[counter], next) == false) {
                        this.handleCallback(cbComplete, resolve);
                        return;
                    }
                    counter++;
                }
                else {
                    this.handleCallback(cbComplete, resolve);
                    return;
                }
            };
            step();
        });
    }
    //#########################################################
    // Utility Methods
    //#########################################################
    /**
     * Returns the string of the SQL statement with the parameters
     *   in place of the question marks.
     *
     * @param {string} sql - SQL statement
     * @param {any | Array<any>} paras - parameters
     * @returns {string}
     */
    printQuery(sql, paras) {
        let i = 0;
        if (!Array.isArray(paras))
            paras = [paras];
        while (sql.indexOf("?") >= 0) {
            sql = sql.replace("?", "'" + paras[i++] + "'");
        }
        return sql;
    }
    /**
     * Handles classic callback or promise and if to throw error or not.
     *
     * @param {Function} cb - classic callback
     * @param {Function} resolve - promise resolve
     * @param {Function} reject - (optional) promise reject
     * @param err - (optional) Error
     * @param result - (optional) Result object
     * @param {Function} cbResume - (optional) cb() to resolve from callback
     */
    handleCallback(cb, resolve, reject = null, err = null, result = null, cbResume = null) {
        this._errorLast = err;
        if (err == null)
            this._errorStack = "";
        if (cb != null)
            cb(err, result, cbResume);
        else {
            if (err != null) {
                if (this._throwErrors && reject != null)
                    reject(err);
                else
                    resolve(err);
            }
            else
                resolve(result);
        }
    }
    /**
     * Generates a unique guid and stores it to this connection.
     *
     * @internal
     * @ignore
     */
    generateGuid() {
        this._guid = Util_1.Util.generateToken(6, PhanxMysql.dictTokens);
    }
}
//static
PhanxMysql.pool = null;
PhanxMysql.dbConfig = null;
PhanxMysql.dictTokens = new dictionaryjs_1.Dictionary();
PhanxMysql.openConnections = new dictionaryjs_1.Dictionary();
PhanxMysql.auto_closer_minutes = 0;
PhanxMysql.auto_closer_interval = null;
exports.PhanxMysql = PhanxMysql;
//##################################################################
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
//##############################################################################
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
                        sql += key + "=? AND ";
                        params.push(this.where[key]);
                    }
                    if (sql.substr(sql.length - 5) == " AND ")
                        sql = sql.substr(0, sql.length - 5);
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
//# sourceMappingURL=PhanxMysql.js.map