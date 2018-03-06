import {PhanxMysql} from "./PhanxMysql";

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
     * @returns {Promise<any>}
     */
    public async finalize():Promise<any> {

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
                let value:any = row[key];
                params.push(value);
            }

        }

        //remove last comma if there is one
        if (sql.substr(sql.length-1) == ",")
            sql = sql.substr(0,sql.length-1);

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

    private createNewValueRow():void {
        this.valuesToSave.push({});
    }




}