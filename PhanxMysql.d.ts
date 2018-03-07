import { PhanxInsert } from "./PhanxInsert";
import { PhanxUpdate } from "./PhanxUpdate";
export declare class PhanxMysql {
    private _config;
    private _client;
    private static pool;
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
    static config: IDbConfig;
    static createAndStart(): Promise<PhanxMysql>;
    static closeAll(cb?: Function): Promise<any>;
    static closePool(cb?: Function): Promise<any>;
    static setAutoCloseMinutes(minutes: number): void;
    throwErrors: boolean;
    config: IDbConfig;
    usePool(): boolean;
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
     * @returns {Promise<any>} - result:Array<any>
     */
    query(sql: string, paras?: any | Array<any>, cb?: (err: any, result?: Array<any>, cbResume?: Function) => void): Promise<any>;
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
     * @param {any} row (optional) - object of key/value column name/values.
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
     * @param {any} row - object of key/value column name/values.
     * @returns {Promise<any>}
     */
    insertAndRun(table: string, values: any): Promise<any>;
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
    updateAndRun(table: string, where: any, whereParams?: Array<any>, values?: any): Promise<any>;
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
    readonly guid: string;
    /**
     * The stack trace for the start of this connection.
     * Useful to narrow down where this connection was created if left open.
     * @returns {String}
     */
    readonly startStack: string;
    /**
     * Returns whether the connection is open or not.
     * @returns {Boolean}
     */
    readonly opened: boolean;
    /**
     * Timestamp of when connection was opened. Linux epoch.
     * @returns {number}
     */
    readonly openedTime: number;
    /**
     * Returns if there was an error from the last operation or null if there wasn't.
     * @returns {any}
     */
    readonly error: any;
    /**
     * Returns array of rows from last query.
     * @returns {Array<any>}
     */
    readonly rows: Array<any>;
    /**
     * Returns the number of rows from last query.
     * @returns {number}
     */
    readonly rowCount: number;
    /**
     * Returns the next row from the last query and moves the cursor to the next.
     * @returns {Object}
     */
    readonly row: object;
    hasRows(): boolean;
    /**
     * @ignore
     * @internal
     */
    [Symbol.iterator]: () => IterableIterator<any>;
    /**
     * Async (non-blocking) loop through last query's rows.
     *
     * @param {Function} cbIterator
     * @param {Function} cbComplete
     * @returns {Promise<any>}
     */
    asyncForEach(cbIterator: Function, cbComplete?: Function): Promise<null>;
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
     * Handles classic callback or promise and if to throw error or not.
     *
     * @param {Function} cb - classic callback
     * @param {Function} resolve - promise resolve
     * @param {Function} reject - (optional) promise reject
     * @param err - (optional) Error
     * @param result - (optional) Result object
     * @param {Function} cbResume - (optional) cb() to resolve from callback
     */
    private handleCallback(cb, resolve, reject?, err?, result?, cbResume?);
    /**
     * Generates a unique guid and stores it to this connection.
     *
     * @internal
     * @ignore
     */
    private generateGuid();
}
export interface IDbConfig {
    usePool: boolean;
    mysql: IMysqlConfig;
    autoCloseMinutes: number;
}
export interface IMysqlConfig {
    host: string;
    database: string;
    user: string;
    password: string;
    connectionLimit: number;
}
