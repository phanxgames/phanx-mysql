import {PhanxMysql} from "./PhanxMysql";

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
     * @returns {Promise<any>}
     */
    public async finalize():Promise<any> {

        if (this.valuesToSave == null) {
            throw new Error("No values were provided to be updated.");
        }

        let params:Array<any> = [];


        let sql:string = "update " + this.table + " set ";

        for (let key in this.valuesToSave) {
            sql += key + "=? ,";
            params.push(this.valuesToSave[key]);
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
                    sql += key + "=?,";
                    params.push(this.where[key]);
                }

                if (sql.substr(sql.length - 1) == ",")
                    sql = sql.substr(0, sql.length - 1);
            }
        }



        await this.db.query(sql,params);


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