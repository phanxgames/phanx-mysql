export declare class PhanxMysql {
    private _config;
    private _client;
    private static pools;
    private static dbConfig;
    private static dictTokens;
    private static openConnections;
    private static auto_closer_minutes;
    private static auto_closer_interval;
    private _startStack;
    private _errorStack;
    private _result;
    private _resultCount;
    private _errorLast;
    cursor: number;
    private _opened;
    private _openedTimestamp;
    private _guid;
    private _throwErrors;
    constructor(config?: IDbConfig);
    static set config(config: IDbConfig);
    static createAndStart(options?: IDbConfig): Promise<PhanxMysql>;
    static closeAll(cb?: Function): Promise<any>;
    static closePool(connectionKey: IMysqlConfig, cb?: Function): Promise<void>;
    static setAutoCloseMinutes(minutes: number): void;
    /**
     * Formats values to be used safely within queries.
     * @param {string} value
     * @param {string} timezone (optional)
     * @returns {string}
     */
    static escape(value: string, timezone?: string): string;
    get throwErrors(): boolean;
    set throwErrors(value: boolean);
    set config(config: IDbConfig);
    get config(): IDbConfig;
    usesPool(): boolean;
    /**
     * Opens database connection.
     *
     * @param {Function} cb - (optional) cb(err:any=null)
     * @returns {Promise<null>}
     */
    start(cb?: (err?: any) => void): Promise<null>;
    /**
     * @alias start(...)
     */
    open(cb?: (err?: any) => void): Promise<null>;
    /**
     * Closes database connection.
     *
     * @param {Function} cb - (optional) cb()
     * @returns {Promise<null>}
     */
    end(cb?: () => void): Promise<null>;
    /**
     * @alias end(...)
     */
    close(cb?: () => void): Promise<null>;
    /**
     * Query the database.
     *
     * @param {string} sql
     * @param {number|string|Array<any>} paras - (optional)
     * @param {Function} cb - (optional) cb(err:any,result:Array<any>,cbResume?:Function)
     * @param {any} context - (optional) your custom context passed through to the callbackRegistrations
     * @returns {Promise<any>} - result:Array<any>
     */
    query(sql: string, paras?: any | Array<any>, cb?: (err: any, result?: Array<any>, cbResume?: Function) => void, context?: any): Promise<any>;
    /**
     * Select the first row from query.
     *
     * @param {string} sql
     * @param {Array<any>} paras - (optional)
     * @param {Function} cb - (optional) cb(err:any,row:any,cbResume?:Function)
     * @returns {Promise<any>}
     */
    selectRow(sql: string, paras?: any | Array<any>, cb?: (err: any, row: any, cbResume?: Function) => void): Promise<any>;
    /**
     * @ignore
     * @alias query(...)
     */
    selectArray(sql: string, paras?: any | Array<any>, cb?: (err: any, row: Array<any>, cbResume?: Function) => void): Promise<any>;
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
    insert(table: string, values?: any): PhanxInsert;
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
    update(table: string, where: any, whereParams?: Array<any>, values?: any): PhanxUpdate;
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
    insertAndRun(table: string, values: any, context?: any): Promise<number>;
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
    updateAndRun(table: string, where: any, whereParams?: Array<any>, values?: any, context?: any): Promise<number>;
    /**
     * Transaction Begin Helper method.
     *
     * @param {Function} cb - (optional) cb(err:any,result:any,cbResume?:Function)
     * @returns {Promise<any>}
     */
    begin(cb?: (err: any, result: any, cbResume?: Function) => void): Promise<any>;
    /**
     * Transaction Commit Helper method.
     *
     * @param {Function} cb - (optional) cb(err:any,result:any,cbResume?:Function)
     * @returns {Promise<any>}
     */
    commit(cb?: (err: any, result: any, cbResume?: Function) => void): Promise<any>;
    /**
     * Transaction Rollback Helper method.
     *
     * @param {Function} cb - (optional) cb(err:any,result:any,cbResume?:Function)
     * @returns {Promise<any>}
     */
    rollback(cb?: (err: any, result: any, cbResume?: Function) => void): Promise<any>;
    /**
     * Global Unique Identifier for this connection.
     * @returns {String}
     */
    get guid(): string;
    /**
     * The stack trace for the start of this connection.
     * Useful to narrow down where this connection was created if left open.
     * @returns {String}
     */
    get startStack(): string;
    /**
     * Returns whether the connection is open or not.
     * @returns {Boolean}
     */
    get opened(): boolean;
    /**
     * Timestamp of when connection was opened. Linux epoch.
     * @returns {number}
     */
    get openedTime(): number;
    /**
     * Returns if there was an error from the last operation or null if there wasn't.
     * @returns {any}
     */
    get error(): any;
    /**
     * Returns array of rows from last query.
     * @returns {Array<any>}
     */
    get rows(): Array<any>;
    /**
     * Returns the number of rows from last query.
     * @returns {number}
     */
    get rowCount(): number;
    /**
     * Returns the next row from the last query and moves the cursor to the next.
     * @returns {Object}
     */
    get row(): object;
    hasRows(): boolean;
    /**
     * @ignore
     * @internal
     */
    [Symbol.iterator]: () => Generator<any, void, unknown>;
    /**
     * Async (non-blocking) loop through last query's rows.
     *
     * @param {Function} cbIterator
     * @param {Function} cbComplete
     * @returns {Promise<any>}
     */
    asyncForEach(cbIterator: Function, cbComplete?: Function): Promise<void>;
    /**
     * Returns the string of the SQL statement with the parameters
     *   in place of the question marks.
     *
     * @param {string} sql - SQL statement
     * @param {any | Array<any>} paras - parameters
     * @returns {string}
     */
    printQuery(sql: string, paras: any | Array<any>): string;
    /**
     * Formats values to be used safely within queries.
     * @param {string} value
     * @param {string} timezone (optional)
     * @returns {string}
     */
    escape(value: string, timezone?: string): string;
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
    private handleCallback;
    private handleCallbackRegistration;
    /**
     * Generates a unique guid and stores it to this connection.
     *
     * @internal
     * @ignore
     */
    private generateGuid;
    /**
     * Extends the default query format behavior of replacing "?" in the query to
     *   also allow named params, such as ":name" and an object passed as a param.
     *
     * @param {string} query
     * @param values
     * @returns {string}
     * @private
     */
    private _namedParamQueryFormatter;
}
export declare class PhanxInsert {
    db: PhanxMysql;
    table: string;
    valuesToSave: Array<any>;
    /**
     * @param {PhanxMysql} db - db reference
     * @param {string} table - table name
     * @param {any} row (optional) - object of key/value column name/values.
     */
    constructor(db: PhanxMysql, table: string, row?: any);
    /**
     * Add a column/value to the current row.
     * @param {string} column - column name
     * @param value - value to insert
     * @returns {PhanxInsert}
     */
    s(column: string, value: any): PhanxInsert;
    /**
     * Adds a new row to the insert.
     * @param obj - key/value pairs
     * @returns {PhanxInsert}
     */
    row(obj: any): PhanxInsert;
    /**
     * Creates a new row. To be used to the s(...) method.
     * @returns {PhanxInsert}
     */
    newRow(): PhanxInsert;
    /**
     * Finalizes the insert query and executes it.
     * @returns {Promise<number>} - returns newly inserted ID
     */
    finalize(context?: any): Promise<number>;
    /**
     * @alias finalize
     * @returns {Promise<any>}
     */
    execute(): Promise<any>;
    /**
     * @alias finalize
     * @returns {Promise<any>}
     */
    run(context?: any): Promise<any>;
    private createNewValueRow;
}
export declare class PhanxUpdate {
    db: PhanxMysql;
    table: string;
    where: any | string;
    whereParams: Array<any>;
    valuesToSave: any;
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
    constructor(db: PhanxMysql, table: string, where: any | string, whereParams?: Array<any>, values?: any);
    /**
     * Add a column/value to the current row.
     * @param {string} column - column name
     * @param value - value to insert
     * @returns {PhanxUpdate}
     */
    s(column: string, value: any): PhanxUpdate;
    /**
     * Adds a new row to the insert.
     * @param obj - key/value pairs
     * @returns {PhanxInsert}
     */
    values(obj: any): PhanxUpdate;
    /**
     * @alias values
     */
    row(obj: any): PhanxUpdate;
    /**
     * Finalizes the insert query and executes it.
     * @returns {Promise<number>} - number of affected rows
     */
    finalize(context?: any): Promise<number>;
    /**
     * @alias finalize
     * @returns {Promise<any>}
     */
    execute(): Promise<any>;
    /**
     * @alias finalize
     * @returns {Promise<any>}
     */
    run(context?: any): Promise<any>;
}
export interface IDbConfig {
    usePool?: boolean;
    poolTimeout?: 30;
    mysql: IMysqlConfig;
    autoCloseMinutes?: number;
    useNamedParamsQueryFormat?: boolean;
    showDebugTraces?: boolean;
    showConnectionLeftOpenTrace?: boolean;
    callbackRegistrations?: ICallbackRegistrations;
}
export interface ICallbackRegistrations {
    cbInsert?: Function;
    cbUpdate?: Function;
    cbDelete?: Function;
    cbQuery?: Function;
}
export interface IMysqlConfig {
    host: string;
    port?: number;
    database: string;
    user: string;
    password: string;
    connectionLimit: number;
    multipleStatements?: boolean;
    queryFormat?: (query: string, values: any) => string;
    connectionTimeout?: number;
    timezone?: string;
}
