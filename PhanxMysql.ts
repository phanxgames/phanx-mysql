
import {Dictionary} from "dictionaryjs";
import * as Mysql from "mysql";
import {Util} from "./Util";

export class PhanxMysql {

    //references
    private _config:IDbConfig = null;
    private _client:any = null;

    //static
    private static pool:any = null;
    private static dbConfig:IDbConfig = null;
    private static dictTokens:Dictionary = new Dictionary();
    private static openConnections:Dictionary = new Dictionary();
    private static auto_closer_minutes:number = 0;
    private static auto_closer_interval:any = null;

    //data set
    private _startStack:String = null;
    private _errorStack:String = null;
    private _result:Array<any> = [];
    private _resultCount:Number = 0;
    private _errorLast:any = null;
    public cursor:number = 0;

    //properties
    private _opened:Boolean = false;
    private _openedTimestamp:Number = 0;
    private _guid:String = null;
    private _throwErrors:Boolean = true;

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

    public static async createAndStart():Promise<PhanxMysql> {
        let db = new PhanxMysql();
        await db.start();
        return db;
    }

    public static closeAll(cb:Function=null):Promise<null> {
        return new Promise((resolve) => {

            PhanxMysql.openConnections.asyncForEach((i,conn,cbNext)=> {
               if (conn != null)
                   conn.close();
               cbNext();
            },() => {
                resolve();
            });

        });
    }

    public static closePool(cb:Function=null):Promise<null> {

        return new Promise((resolve,reject)=> {

            let pool = PhanxMysql.pool;

            if (pool != null) {

                pool.end((err)=> {

                    console.log("pool closed");
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

        PhanxMysql.auto_closer_minutes = minutes;
        let enabled:Boolean = (minutes>0);

        if (enabled) {
            PhanxMysql.auto_closer_interval = setInterval(() => {

                let outlog = "";
                let counter = 0;

                PhanxMysql.openConnections.asyncForEach(function(guid,db,cbNext) {

                    counter++;
                    if (db.opened) {
                        let minutes = Util.getTimeDiff(db.openedTime,"min");
                        if (minutes > PhanxMysql.auto_closer_minutes) {
                            outlog += "\n[" + db.guid + "] Db Opened : " + minutes +
                                " minutes\n" + db.startStack+"\n";

                            //auto closer
                            db.end();
                        }
                    }
                    cbNext();

                },function() {
                    if (outlog!="") {
                        console.error("----------------------------------------\n" +
                            "**** " + counter +
                            " Database Connection Auto-Closed ****" + outlog +
                            "\n----------------------------------------");

                    } else if (counter > 0) {
                        console.log("Database connections still opened ("+counter+").");
                    }
                });

            }, 10000);
        }



    }

    //#########################################################
    // Config Methods
    //#########################################################

    public get throwErrors():Boolean {
        return this._throwErrors;
    }

    public set throwErrors(value:Boolean) {
        this._throwErrors = value;
    }


    public set config(config:IDbConfig) {
        this._config = config;
    }

    public get config():IDbConfig {
        if (this._config == null) {
            return PhanxMysql.dbConfig;
        }
        return this._config;
    }


    public usePool():Boolean {
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

        this._startStack =
        this._errorStack = new Error().stack;


        return new Promise((resolve, reject) => {

            try {

                if (this.usePool()) {

                    if (PhanxMysql.pool == null)
                        PhanxMysql.pool = Mysql.createPool(this.config.mysql);

                    PhanxMysql.pool.getConnection((err: Error, conn: any) => {

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

                        let err = new Error("Database connection already open.");
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

                let elapsed:Number = Util.getTimeDiff(this._openedTimestamp, "ms");

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


            } else {

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
    public close(cb:()=>void=null):Promise<null> {
        return this.end(cb);
    }




    //##############################################
    // query method
    //##############################################

    /**
     * Query the database.
     *
     * @param {String} sql
     * @param {Array<any>} paras - (optional)
     * @param {Function} cb - (optional) cb(err:any,result:Array<any>,cbResume?:Function)
     * @returns {Promise<any>} - result:Array<any>
     */
    public query(sql:String, paras:Array<any>=null,
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

            this._client.query(sql,paras, (err:Error, result:Object):void => {

                let elapsed:String = Util.timeEnd(timeStart);

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

                console.log("Query completed in " + elapsed + " seconds.");

                //result = result as Object;

                if (Array.isArray(result))
                    this._result = result;
                else
                    this._result = [result];

                this._resultCount = this._result.length;

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
     * @param {String} sql
     * @param {Array<any>} paras - (optional)
     * @param {Function} cb - (optional) cb(err:any,row:any,cbResume?:Function)
     * @returns {Promise<any>}
     */
    public selectRow(sql:String, paras:Array<any>=null,
                     cb:(err:any,row:any,cbResume?:Function)=>void=null):Promise<any>
    {
        return new Promise((resolve, reject) => {

            this.query(sql, paras, (err:any, result:any):void => {
                if (err || result == null || result.length < 1) {
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
    public selectArray(sql:String, paras:Array<any>=null,
                       cb:(err:any,row:Array<any>,cbResume?:Function)=>void=null)
    :Promise<any>
    {
        return this.query(sql, paras, cb);
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
    public get guid():String {
        return this._guid;
    }

    /**
     * The stack trace for the start of this connection.
     * Useful to narrow down where this connection was created if left open.
     * @returns {String}
     */
    public get startStack():String {
        return this._startStack;
    }

    /**
     * Returns whether the connection is open or not.
     * @returns {Boolean}
     */
    public get opened():Boolean {
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
    public get row():Object {
        if (this.cursor >= this.rowCount)
            return null;
        let row:Object = this._result[this.cursor];
        this.cursor++;
        return row;
    }

    public hasRows():Boolean {
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
    public asyncForEach(cbIterator:Function, cbComplete:Function=null):Promise<null> {

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

    /**
     * Generates a unique guid and stores it to this connection.
     *
     * @internal
     * @ignore
     */
    private generateGuid():void {
        this._guid = Util.generateToken(6, PhanxMysql.dictTokens);
    }


}



export interface IDbConfig {
    usePool:Boolean,
    mysql:IMysqlConfig,
    autoCloseMinutes:number
}
interface IMysqlConfig {
    host:String;
    database:String;
    user:String;
    password:String;
    connectionLimit:Number;
}
interface IDbError {
    stack:String;
    sql:String;
    paras:Array<any>;
    message:String;
}


