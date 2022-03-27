import {Dictionary} from "dictionaryjs";
import * as Mysql from "mysql";
import {Util} from "./Util";

const SqlString = require("sqlstring");

export class PhanxMysql {

    //references
    private _config:IDbConfig = null;
    private _client:any = null;

    //static
    private static pool:any = null;
    private static dbConfig:IDbConfig = null;
    private static dictTokens:Dictionary<string,boolean> = new Dictionary<string,boolean>();
    private static openConnections:Dictionary<string,PhanxMysql> =
        new Dictionary<string,PhanxMysql>();
    private static auto_closer_minutes:number = 0;
    private static auto_closer_interval:any = null;

    //data set
    private _startStack:string = null;
    private _errorStack:string = null;
    private _result:Array<any> = [];
    private _resultCount:number = 0;
    private _errorLast:any = null;
    public cursor:number = 0;

    //properties
    private _opened:boolean = false;
    private _openedTimestamp:number = 0;
    private _guid:string = null;
    private _throwErrors:boolean = true;

    constructor(config:IDbConfig=null) {
        this.config = config;

        PhanxMysql.setAutoCloseMinutes(PhanxMysql.auto_closer_minutes);
    }

    //#########################################################
    // Static Methods
    //#########################################################

    public static set config(config:IDbConfig) {
        PhanxMysql.dbConfig = config;
        PhanxMysql.setAutoCloseMinutes(config.autoCloseMinutes);
    }

    public static async createAndStart(options:IDbConfig=null):Promise<PhanxMysql> {
        let db:PhanxMysql = new PhanxMysql(options);
        await db.start();
        return db;
    }

    public static async closeAll(cb:Function=null):Promise<any> {

        for (let conn of PhanxMysql.openConnections) {
            if (conn != null)
                await conn.close();
        }

        if (cb!=null)
            cb();

    }

    public static closePool(cb:Function=null):Promise<void> {

        return new Promise((resolve,reject)=> {

            let pool = PhanxMysql.pool;

            if (pool != null) {

                pool.end((err)=> {

                    //if (PhanxMysql.dbConfig.showDebugTraces)
                    //    console.log("pool closed");

                    console.error(err);

                    if (cb != null)
                        cb(err);
                    else {
                        if (err != null) {
                            reject(err);
                        } else
                            resolve();
                    }

                });

            }
        });


    }


    public static setAutoCloseMinutes(minutes:number):void {

        if (PhanxMysql.auto_closer_interval != null)
            clearInterval(PhanxMysql.auto_closer_interval);

        if (minutes==null || !Util.isNumeric(minutes))
            minutes = 0;

        PhanxMysql.auto_closer_minutes = minutes;
        let enabled:boolean = (minutes>0);


        if (enabled) {
            PhanxMysql.auto_closer_interval = setInterval(() => {

                let outlog:string = "";
                let counter:number = 0;

                for (let db of PhanxMysql.openConnections) {
                    counter++;
                    if (db!=null && db.opened) {
                        let minutes:number = Util.getTimeDiff(db.openedTime,"min");
                        if (minutes > PhanxMysql.auto_closer_minutes) {
                            outlog += "\n[" + db.guid + "] Db Opened : " + minutes +
                                " minutes\n" + db.startStack+"\n";

                            //auto closer
                            db.end();
                        }
                    }
                }

                if (outlog!="") {
                    if (PhanxMysql.dbConfig.showDebugTraces)
                        console.error("----------------------------------------\n" +
                        "**** " + counter +
                        " Database Connection Auto-Closed ****" + outlog +
                        "\n----------------------------------------");

                } else if (counter > 0) {
                    if (PhanxMysql.dbConfig.showDebugTraces)
                        console.log("Database connections still opened ("+counter+").");
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
    public static escape(value:string, timezone:string=null):string {
        return SqlString.escape(value, false, timezone);
    }

    //#########################################################
    // Config Methods
    //#########################################################

    public get throwErrors():boolean {
        return this._throwErrors;
    }

    public set throwErrors(value:boolean) {
        this._throwErrors = value;
    }


    public set config(config:IDbConfig) {
        this._config = config;
    }

    public get config():IDbConfig {
        let config:IDbConfig;

        if (this._config == null) {
            config = PhanxMysql.dbConfig;
        } else {
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

    public usesPool():boolean {
        return (this.config.usePool==true);
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
    public start(cb:(err?:any)=>void=null):Promise<null> {

        this._startStack = this._errorStack = new Error().stack;

        return new Promise((resolve, reject) => {

            try {

                if (this.usesPool()) {

                    if (PhanxMysql.pool == null)
                        PhanxMysql.pool = Mysql.createPool(this.config.mysql);

                    let timeout = setTimeout(()=> {
                        console.log("---------------------------------");
                        console.error("Timeout getting connection from pool after " +
                            this.config.poolTimeout + " seconds. " +
                            PhanxMysql.openConnections.size() +
                            " Connections left open. Please close connections after use," +
                            " or enable \"autoCloseMinutes\".");
                        if (PhanxMysql.openConnections.size() >= 1) {
                            if (PhanxMysql.dbConfig.showDebugTraces ||
                                PhanxMysql.dbConfig.showConnectionLeftOpenTrace)
                            {

                                for (let db of  PhanxMysql.openConnections)
                                {
                                    if (db==null) continue;

                                    let minutes:number = Util.getTimeDiff(db.openedTime,"min");

                                    console.log("\n[" + db.guid + "] Db Opened : " + minutes +
                                        " minutes\n" + db.startStack + "\n");

                                }
                            } else {
                                console.log("Enable \"showDebugTraces\" or \"showConnectionLeftOpenTrace\" in config to see full stack trace on open connections.");
                            }
                        }

                    }, this.config.poolTimeout*1000);

                    PhanxMysql.pool.getConnection((err: Error, conn: any) => {

                        clearTimeout(timeout);

                        if (err) {

                            console.error("Problem getting database connection from pool:\n",
                                this._errorStack, "\n", err);


                            this.handleCallback(cb, resolve, reject, err);

                            return;
                        }


                        this.generateGuid();
                        this._openedTimestamp = Util.getTimestamp();
                        this._opened = true;
                        this._client = conn;

                        PhanxMysql.openConnections.set(this._guid, this);

                        this.handleCallback(cb, resolve);

                    });


                } else {

                    //non pool connection

                    if (this._opened) {

                        let err:Error = new Error("Database connection already open.");
                        console.error(err);

                        this.handleCallback(cb, resolve, reject, err);

                        return;
                    }


                    let connection = Mysql.createConnection(this.config.mysql);

                    connection.connect((err) => {

                        if (err) {
                            console.error("Problem getting database connection:\n",
                                this._errorStack, "\n", err);


                            this.handleCallback(cb, resolve, reject, err);

                            return;
                        }

                        this.generateGuid();
                        this._opened = true;
                        this._openedTimestamp = Util.getTimestamp();
                        this._client = connection;

                        PhanxMysql.openConnections.set(this._guid, this);

                        this.handleCallback(cb, resolve);



                    });


                }

            } catch (err) {

                console.error("Problem getting database connection:\n",
                    this._errorStack, "\n", err);


                this.handleCallback(cb, resolve, reject, err);


            }

        });

    }

    /**
     * @alias start(...)
     */
    public open(cb:(err?:any)=>void=null):Promise<null> {
        return this.start(cb);
    }


    /**
     * Closes database connection.
     *
     * @param {Function} cb - (optional) cb()
     * @returns {Promise<null>}
     */
    public end(cb:()=>void=null):Promise<null> {

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


            } else {

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
    public close(cb:()=>void=null):Promise<null> {
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
    public query(sql:string, paras:any|Array<any>=null,
                 cb:(err:any,result?:Array<any>,cbResume?:Function)=>void=null)
                :Promise<any>
    {

        this._errorStack = new Error().stack;

        return new Promise((resolve, reject) => {

            this._resultCount = 0;
            this._result = [];

            if (this._client == null) {

                let err:Error = new Error("Database Connection is not open.");
                console.error(err);

                this.handleCallback(cb, resolve, reject, err, null,()=> {
                    resolve(null);
                });


                return;
            }

            let timeStart:any = Util.timeStart();

            if (!Array.isArray(paras) && !Util.isObject(paras))
                paras = [paras];

            this._client.query(sql,paras, (err:Error, result:Object):void => {

                let elapsed:string = Util.timeEnd(timeStart);

                if (err || result == null) {

                    let errObj:IDbError = {
                        stack: this._errorStack,
                        sql: sql,
                        paras: paras,
                        message: "Unspecified Database Query Error."
                    };

                    if (err != null && err.hasOwnProperty("message")) {
                        errObj.message = err.message;
                    }

                    console.error("Database Error (" + elapsed + "s): ", errObj);

                    this.handleCallback(cb, resolve, reject, errObj, null,()=> {
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



                this.handleCallbackRegistration('query', sql, paras);

                this.handleCallback(cb, resolve, reject, null, this._result,
                    ()=> {
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
    public selectRow(sql:string, paras:any|Array<any>=null,
                     cb:(err:any,row:any,cbResume?:Function)=>void=null):Promise<any>
    {
        return new Promise((resolve, reject) => {

            this.query(sql, paras, (err:any, result:any):void => {
                if (err || result == null || result.length < 1) {
                    result = null;
                    this.handleCallback(cb, resolve, reject, err, result, () => {
                        resolve(result);
                    });
                    return;
                }
                this.handleCallback(cb, resolve, reject, null, result[0],() => {
                    resolve(result[0]);
                });
            })

        });
    }

    /**
     * @ignore
     * @alias query(...)
     */
    public selectArray(sql:string, paras:any|Array<any>=null,
                       cb:(err:any,row:Array<any>,cbResume?:Function)=>void=null)
    :Promise<any>
    {
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
    public insert(table:string, values:any=null):PhanxInsert {
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
    public update(table:string, where:any,
                  whereParams:Array<any>=null, values:any=null):PhanxUpdate
    {
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
     * @returns {Promise<number>} - newly inserted id
     */
    public insertAndRun(table:string, values:any):Promise<number> {
        return (this.insert(table,values)).run();
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
     * @returns {Promise<number>} - number of rows affected
     */
    public updateAndRun(table:string, where:any,
                        whereParams:Array<any>=null, values:any=null):Promise<number>
    {
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
    public begin(cb:(err:any,result:any,cbResume?:Function)=>void=null):Promise<any> {
        return this.query("START TRANSACTION;",null,cb);
    }

    /**
     * Transaction Commit Helper method.
     *
     * @param {Function} cb - (optional) cb(err:any,result:any,cbResume?:Function)
     * @returns {Promise<any>}
     */
    public commit(cb:(err:any,result:any,cbResume?:Function)=>void=null):Promise<any> {
        return this.query("COMMIT;", null, cb);
    }

    /**
     * Transaction Rollback Helper method.
     *
     * @param {Function} cb - (optional) cb(err:any,result:any,cbResume?:Function)
     * @returns {Promise<any>}
     */
    public rollback(cb:(err:any,result:any,cbResume?:Function)=>void=null):Promise<any> {
        return this.query("ROLLBACK;", null, cb);
    }

    //#########################################################
    // Instance Get Methods
    //#########################################################

    /**
     * Global Unique Identifier for this connection.
     * @returns {String}
     */
    public get guid():string {
        return this._guid;
    }

    /**
     * The stack trace for the start of this connection.
     * Useful to narrow down where this connection was created if left open.
     * @returns {String}
     */
    public get startStack():string {
        return this._startStack;
    }

    /**
     * Returns whether the connection is open or not.
     * @returns {Boolean}
     */
    public get opened():boolean {
        return this._opened;
    }

    /**
     * Timestamp of when connection was opened. Linux epoch.
     * @returns {number}
     */
    public get openedTime():number {
        return this._openedTimestamp as number;
    }

    /**
     * Returns if there was an error from the last operation or null if there wasn't.
     * @returns {any}
     */
    public get error():any {
        return this._errorLast;
    }


    //#########################################################
    // Result Methods
    //#########################################################

    /**
     * Returns array of rows from last query.
     * @returns {Array<any>}
     */
    public get rows():Array<any> {
        return this._result;
    }

    /**
     * Returns the number of rows from last query.
     * @returns {number}
     */
    public get rowCount():number {
        return this._resultCount as number;
    }

    /**
     * Returns the next row from the last query and moves the cursor to the next.
     * @returns {Object}
     */
    public get row():object {
        if (this.cursor >= this.rowCount)
            return null;
        let row:object = this._result[this.cursor];
        this.cursor++;
        return row;
    }

    public hasRows():boolean {
       return (this.cursor < this.rowCount);
    }

    /**
     * @ignore
     * @internal
     */
    public [Symbol.iterator] = function*() {
        for (let row of this._result) {
            yield row;
        }
    };

    /**
     * Async (non-blocking) loop through last query's rows.
     *
     * @param {Function} cbIterator
     * @param {Function} cbComplete
     * @returns {Promise<any>}
     */
    public asyncForEach(cbIterator:Function, cbComplete:Function=null):Promise<void> {

        return new Promise((resolve) => {

            let counter:number = 0;
            let len:number = this.rowCount;

            let next:Function = ():void => {
                if (counter < len) {
                    process.nextTick(step);
                    //setTimeout(step,100);
                } else {
                    if (cbComplete!=null)
                        cbComplete();
                    else
                        resolve();
                    return;
                }
            };

            let step:Function = ():void => {
                if (counter < len ) {
                    if (cbIterator(counter, this._result[counter], next) == false) {
                        this.handleCallback(cbComplete, resolve);
                        return;
                    }
                    counter++;

                } else {
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
    public printQuery(sql:string, paras:any|Array<any>):string {
        return this._namedParamQueryFormatter(sql, paras);
    }

    /**
     * Formats values to be used safely within queries.
     * @param {string} value
     * @param {string} timezone (optional)
     * @returns {string}
     */
    public escape(value:string, timezone:string=null):string {
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
    private handleCallback(cb:Function, resolve:Function, reject:Function=null,
                           err:any=null, result:any=null,
                           cbResume:Function=null):void
    {
        this._errorLast = err;

        if (err==null)
            this._errorStack = "";

        if (cb != null)
            cb(err, result, cbResume);
        else {
            if (err != null) {
                if (this._throwErrors && reject != null)
                    reject(err);
                else
                    resolve(err);
            } else
                resolve(result);
        }
    }

    private  handleCallbackRegistration(source:string,
                                             sql:string, paras:any|Array<any>=null)
    :void
    {
        let cbRegs:ICallbackRegistrations = this.config?.callbackRegistrations;

        if (cbRegs == null) {
            return;
        }

        sql = sql.toLowerCase();
        sql = sql.trim();

        let operation:string = "";
        let table:string = "";

        let arrSqlParts:Array<string> = sql.split(" ");



        switch (source=="query"?arrSqlParts[0]:source)
        {
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

                let i:number = 0;
                let lastWord:string ;
                for (let word of arrSqlParts)
                {
                    if (lastWord == "from") {
                        table = word;
                        break;
                    }
                    i++;
                    lastWord = word;
                }

                break;
        }

        let cbFunction:Function ;

        switch (operation) {
            case "update":
                cbFunction = this.config?.callbackRegistrations?.cbUpdate;
                break;
            case "insert":
                cbFunction = this.config?.callbackRegistrations?.cbInsert;
                break;
            case "delete":
                cbFunction = this.config?.callbackRegistrations?.cbDelete;
                break;
        }

        if (cbFunction!=null) {
            cbFunction(table, operation, sql, paras);
        }


    }

    /**
     * Generates a unique guid and stores it to this connection.
     *
     * @internal
     * @ignore
     */
    private generateGuid():void {
        this._guid = Util.generateToken(6, PhanxMysql.dictTokens);
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
    private _namedParamQueryFormatter(query: string, values: any):string {

        let timezone:string = null;
        if (this.config!=null && this.config.mysql!=null)
            timezone = this.config.mysql.timezone;

        if (Util.isObject(values)) {
            return query.replace(/\:(\w+)/g,  (txt, key) => {
                if (values.hasOwnProperty(key)) {
                    return PhanxMysql.escape(values[key], timezone);
                }
                return txt;
            });

        } else {
            return SqlString.format(query, values, false, timezone);
        }


    }


}
//##################################################################


export class PhanxInsert {

    public db:PhanxMysql;
    public table:string;

    public valuesToSave:Array<any> = [];

    /**
     * @param {PhanxMysql} db - db reference
     * @param {string} table - table name
     * @param {any} row (optional) - object of key/value column name/values.
     */
    constructor(db:PhanxMysql, table:string, row:any=null) {
        this.db = db;
        this.table = table;
        if (row!=null)
            this.row(row);
    }

    /**
     * Add a column/value to the current row.
     * @param {string} column - column name
     * @param value - value to insert
     * @returns {PhanxInsert}
     */
    public s(column:string, value:any):PhanxInsert {
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
    public row(obj:any):PhanxInsert {
        this.valuesToSave.push(obj);
        return this;
    }

    /**
     * Creates a new row. To be used to the s(...) method.
     * @returns {PhanxInsert}
     */
    public newRow():PhanxInsert {
        this.createNewValueRow();
        return this;
    }

    /**
     * Finalizes the insert query and executes it.
     * @returns {Promise<number>} - returns newly inserted ID
     */
    public async finalize():Promise<number> {

        if (this.valuesToSave == null || this.valuesToSave.length == 0) {
            throw new Error("No rows were provided to be inserted.");
        }

        let params:Array<any> = [];

        let firstRow:any = this.valuesToSave[0];
        let firstRowKeys:Array<string> = Object.keys(firstRow);


        let sql:string = "insert into " + this.table + " ";
        sql += "(" + firstRowKeys.join(",") + ") VALUES ";

        let questionMarkTemplate:string = firstRowKeys.map(x => "?").join(",");

        for (let row of this.valuesToSave) {

            if (row == null) continue;

            //place question marks
            sql += "(" + questionMarkTemplate + "),";

            for (let key in row) {
                if (row.hasOwnProperty(key)) {
                    let value: any = row[key];
                    params.push(value);
                }
            }

        }

        //remove last comma if there is one
        if (sql.substr(sql.length-1) == ",")
            sql = sql.substr(0,sql.length-1);

        let result:any = await this.db.query(sql,params);

        if (Array.isArray(result) && result.length > 0)
            result = result[0];

        return result.insertId;


    }

    /**
     * @alias finalize
     * @returns {Promise<any>}
     */
    public async execute():Promise<any> {
        return this.finalize();
    }

    /**
     * @alias finalize
     * @returns {Promise<any>}
     */
    public async run():Promise<any> {
        return this.finalize();
    }

    private createNewValueRow():void {
        this.valuesToSave.push({});
    }




}

//##############################################################################

export class PhanxUpdate {

    public db:PhanxMysql;
    public table:string;
    public where:any|string;
    public whereParams:Array<any>;

    public valuesToSave:any = {};

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
    constructor(db:PhanxMysql, table:string,
                where:any|string,
                whereParams:Array<any>=null,
                values:any=null)
    {
        this.db = db;
        this.table = table;
        this.where = where;
        this.whereParams = whereParams;
        if (values!=null)
            this.row(values);

    }

    /**
     * Add a column/value to the current row.
     * @param {string} column - column name
     * @param value - value to insert
     * @returns {PhanxUpdate}
     */
    public s(column:string, value:any):PhanxUpdate {
        this.valuesToSave[column] = value;
        return this;
    }

    /**
     * Adds a new row to the insert.
     * @param obj - key/value pairs
     * @returns {PhanxInsert}
     */
    public values(obj:any):PhanxUpdate {
        this.valuesToSave = obj;
        return this;
    }

    /**
     * @alias values
     */
    public row(obj:any):PhanxUpdate {
        return this.values(obj);
    }

    /**
     * Finalizes the insert query and executes it.
     * @returns {Promise<number>} - number of affected rows
     */
    public async finalize():Promise<number> {

        if (this.valuesToSave == null) {
            throw new Error("No values were provided to be updated.");
        }

        let params:Array<any> = [];


        let sql:string = "update " + this.table + " set ";

        for (let key in this.valuesToSave) {
            if (this.valuesToSave.hasOwnProperty(key)) {
                sql += key + "=? ,";
                params.push(this.valuesToSave[key]);
            }
        }

        //remove last comma if there is one
        if (sql.substr(sql.length-1) == ",")
            sql = sql.substr(0,sql.length-1);


        //where clause
        if (this.where != null && this.where != "") {
            if (typeof(this.where) == "string") {
                sql += " where " + this.where;
                if (this.whereParams!=null)
                    params = params.concat(this.whereParams);
            } else {

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



        let result:any = await this.db.query(sql,params);

        if (Array.isArray(result) && result.length > 0)
            result = result[0];

        return result.changedRows;


    }

    /**
     * @alias finalize
     * @returns {Promise<any>}
     */
    public async execute():Promise<any> {
        return this.finalize();
    }

    /**
     * @alias finalize
     * @returns {Promise<any>}
     */
    public async run():Promise<any> {
        return this.finalize();
    }

}


//##############################################################################

export interface IDbConfig {
    usePool?:boolean,
    poolTimeout?:30,
    mysql:IMysqlConfig,
    autoCloseMinutes?:number,
    useNamedParamsQueryFormat?:boolean,
    showDebugTraces?:boolean,
    showConnectionLeftOpenTrace?:boolean,
    callbackRegistrations?:ICallbackRegistrations
}
export interface ICallbackRegistrations {
    cbInsert?:Function,
    cbUpdate?:Function,
    cbDelete?:Function,
    cbQuery?:Function
}

export interface IMysqlConfig {
    host:string;
    port?:number,
    database:string;
    user:string;
    password:string;
    connectionLimit:number;
    multipleStatements?:boolean;
    queryFormat?:(query: string, values: any)=> string;
    connectionTimeout?:number;
    timezone?: string;
}
interface IDbError {
    stack:string;
    sql:string;
    paras:any|Array<any>;
    message:string;
}


