"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhanxUpdate = exports.PhanxInsert = exports.PhanxMysql = void 0;
const dictionaryjs_1 = require("dictionaryjs");
const Mysql = require("mysql");
const Util_1 = require("./Util");
const SqlString = require("sqlstring");
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
        this[_a] = function* () {
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
    static createAndStart(options = null) {
        return __awaiter(this, void 0, void 0, function* () {
            let db = new PhanxMysql(options);
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
    static closePool(connectionKey, cb = null) {
        return new Promise((resolve, reject) => {
            let pool = PhanxMysql.pools.get(connectionKey);
            if (pool != null) {
                pool.end((err) => {
                    //if (PhanxMysql.dbConfig.showDebugTraces)
                    //    console.log("pool closed");
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
        if (minutes == null || !Util_1.Util.isNumeric(minutes))
            minutes = 0;
        PhanxMysql.auto_closer_minutes = minutes;
        let enabled = (minutes > 0);
        if (enabled) {
            PhanxMysql.auto_closer_interval = setInterval(() => {
                let outlog = "";
                let counter = 0;
                for (let db of PhanxMysql.openConnections) {
                    counter++;
                    if (db != null && db.opened) {
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
                    if (PhanxMysql.dbConfig.showDebugTraces)
                        console.error("----------------------------------------\n" +
                            "**** " + counter +
                            " Database Connection Auto-Closed ****" + outlog +
                            "\n----------------------------------------");
                }
                else if (counter > 0) {
                    if (PhanxMysql.dbConfig.showDebugTraces)
                        console.log("Database connections still opened (" + counter + ").");
                }
            }, 10000);
        }
    }
    /**
     * Formats values to be used safely within queries.
     * @param {string} value
     * @param {string} timezone (optional)
     * @returns {string}
     */
    static escape(value, timezone = null) {
        return SqlString.escape(value, false, timezone);
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
        let config;
        if (this._config == null) {
            config = PhanxMysql.dbConfig;
        }
        else {
            config = this._config;
        }
        if (config.useNamedParamsQueryFormat) {
            config.mysql.queryFormat = this._namedParamQueryFormatter;
        }
        if (config.poolTimeout == null) {
            config.poolTimeout = 30;
        }
        return config;
    }
    usesPool() {
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
                if (this.usesPool()) {
                    let pool = PhanxMysql.pools.get(this.config.mysql);
                    if (pool == null) {
                        pool = Mysql.createPool(this.config.mysql);
                        PhanxMysql.pools.set(this.config.mysql, pool);
                    }
                    let timeout = setTimeout(() => {
                        console.log("---------------------------------");
                        console.error("Timeout getting connection from pool after " +
                            this.config.poolTimeout + " seconds. " +
                            PhanxMysql.openConnections.size +
                            " Connections left open. Please close connections after use," +
                            " or enable \"autoCloseMinutes\".");
                        if (PhanxMysql.openConnections.size >= 1) {
                            if (PhanxMysql.dbConfig.showDebugTraces ||
                                PhanxMysql.dbConfig.showConnectionLeftOpenTrace) {
                                for (let db of PhanxMysql.openConnections) {
                                    if (db == null)
                                        continue;
                                    let minutes = Util_1.Util.getTimeDiff(db.openedTime, "min");
                                    console.log("\n[" + db.guid + "] Db Opened : " + minutes +
                                        " minutes\n" + db.startStack + "\n");
                                }
                            }
                            else {
                                console.log("Enable \"showDebugTraces\" or \"showConnectionLeftOpenTrace\" in config to see full stack trace on open connections.");
                            }
                        }
                    }, this.config.poolTimeout * 1000);
                    pool.getConnection((err, conn) => {
                        clearTimeout(timeout);
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
                // if (this.config.showDebugTraces) {
                //     let elapsed:number = Util.getTimeDiff(this._openedTimestamp, "ms");
                //     console.log("Connection released after in use for " + elapsed + " ms.");
                // }
            }
            if (this._client == null) {
                this.handleCallback(cb, resolve);
                return;
            }
            if (this.usesPool()) {
                this._client.release();
                PhanxMysql.openConnections.remove(this._guid);
                PhanxMysql.dictTokens.remove(this._guid);
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
                    PhanxMysql.dictTokens.remove(this._guid);
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
     * @param {any} context - (optional) your custom context passed through to the callbackRegistrations
     * @returns {Promise<any>} - result:Array<any>
     */
    query(sql, paras = null, cb = null, context = null) {
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
            if (!Array.isArray(paras) && !Util_1.Util.isObject(paras))
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
                //if (this.config.showDebugTraces)
                //    console.log("Query completed in " + elapsed + " seconds.");
                //result = result as Object;
                if (Array.isArray(result))
                    this._result = result;
                else
                    this._result = [result];
                this._resultCount = this._result.length;
                this.handleCallbackRegistration('query', sql, paras, context);
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
                    result = null;
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
     * @param {any} values (optional) - object of key/value column name/values.
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
     * @param {any} values - object of key/value column name/values.
     * @param {any} context (optional) - your custom context passed through to the callbackRegistrations
     * @returns {Promise<number>} - newly inserted id
     */
    insertAndRun(table, values, context = null) {
        return (this.insert(table, values)).run(context);
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
     * @param {any} context (optional) - your custom context passed through to the callbackRegistrations
     * @returns {Promise<number>} - number of rows affected
     */
    updateAndRun(table, where, whereParams = null, values = null, context = null) {
        return (this.update(table, where, whereParams, values)).run(context);
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
        return this._namedParamQueryFormatter(sql, paras);
    }
    /**
     * Formats values to be used safely within queries.
     * @param {string} value
     * @param {string} timezone (optional)
     * @returns {string}
     */
    escape(value, timezone = null) {
        return SqlString.escape(value, false, timezone);
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
    handleCallbackRegistration(source, sql, paras = null, context = null) {
        var _b, _c, _d, _e, _f, _g, _h;
        let cbRegs = (_b = this.config) === null || _b === void 0 ? void 0 : _b.callbackRegistrations;
        if (cbRegs == null) {
            return;
        }
        sql = sql.toLowerCase();
        sql = sql.trim();
        let operation = "";
        let table = "";
        let arrSqlParts = sql.split(" ");
        switch (source == "query" ? arrSqlParts[0] : source) {
            case "update":
                operation = arrSqlParts[0];
                table = arrSqlParts[1];
                break;
            case "insert":
                operation = arrSqlParts[0];
                //into
                table = arrSqlParts[2];
                break;
            case "delete":
                operation = arrSqlParts[0];
                let i = 0;
                let lastWord;
                for (let word of arrSqlParts) {
                    if (lastWord == "from") {
                        table = word;
                        break;
                    }
                    i++;
                    lastWord = word;
                }
                break;
        }
        let cbFunction;
        switch (operation) {
            case "update":
                cbFunction = (_d = (_c = this.config) === null || _c === void 0 ? void 0 : _c.callbackRegistrations) === null || _d === void 0 ? void 0 : _d.cbUpdate;
                break;
            case "insert":
                cbFunction = (_f = (_e = this.config) === null || _e === void 0 ? void 0 : _e.callbackRegistrations) === null || _f === void 0 ? void 0 : _f.cbInsert;
                break;
            case "delete":
                cbFunction = (_h = (_g = this.config) === null || _g === void 0 ? void 0 : _g.callbackRegistrations) === null || _h === void 0 ? void 0 : _h.cbDelete;
                break;
        }
        if (cbFunction != null) {
            cbFunction(table, operation, sql, paras, context);
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
    /**
     * Extends the default query format behavior of replacing "?" in the query to
     *   also allow named params, such as ":name" and an object passed as a param.
     *
     * @param {string} query
     * @param values
     * @returns {string}
     * @private
     */
    _namedParamQueryFormatter(query, values) {
        let timezone = null;
        if (this.config != null && this.config.mysql != null)
            timezone = this.config.mysql.timezone;
        if (Util_1.Util.isObject(values)) {
            return query.replace(/\:(\w+)/g, (txt, key) => {
                if (values.hasOwnProperty(key)) {
                    return PhanxMysql.escape(values[key], timezone);
                }
                return txt;
            });
        }
        else {
            return SqlString.format(query, values, false, timezone);
        }
    }
}
exports.PhanxMysql = PhanxMysql;
_a = Symbol.iterator;
//static
PhanxMysql.pools = new Map();
PhanxMysql.dbConfig = null;
PhanxMysql.dictTokens = new dictionaryjs_1.Dictionary();
PhanxMysql.openConnections = new dictionaryjs_1.Dictionary();
PhanxMysql.auto_closer_minutes = 0;
PhanxMysql.auto_closer_interval = null;
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
     * @returns {Promise<number>} - returns newly inserted ID
     */
    finalize(context = null) {
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
                    if (row.hasOwnProperty(key)) {
                        let value = row[key];
                        params.push(value);
                    }
                }
            }
            //remove last comma if there is one
            if (sql.substr(sql.length - 1) == ",")
                sql = sql.substr(0, sql.length - 1);
            let result = yield this.db.query(sql, params, null, context);
            if (Array.isArray(result) && result.length > 0)
                result = result[0];
            return result.insertId;
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
    run(context = null) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.finalize(context);
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
     * @returns {Promise<number>} - number of affected rows
     */
    finalize(context = null) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.valuesToSave == null) {
                throw new Error("No values were provided to be updated.");
            }
            let params = [];
            let sql = "update " + this.table + " set ";
            for (let key in this.valuesToSave) {
                if (this.valuesToSave.hasOwnProperty(key)) {
                    sql += key + "=? ,";
                    params.push(this.valuesToSave[key]);
                }
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
                        if (this.where.hasOwnProperty(key)) {
                            sql += key + "=? AND ";
                            params.push(this.where[key]);
                        }
                    }
                    if (sql.substr(sql.length - 5) == " AND ")
                        sql = sql.substr(0, sql.length - 5);
                }
            }
            let result = yield this.db.query(sql, params, null, context);
            if (Array.isArray(result) && result.length > 0)
                result = result[0];
            return result.changedRows;
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
    run(context = null) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.finalize(context);
        });
    }
}
exports.PhanxUpdate = PhanxUpdate;
//# sourceMappingURL=PhanxMysql.js.map