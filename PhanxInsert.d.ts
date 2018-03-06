import { PhanxMysql } from "./PhanxMysql";
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
     * @returns {Promise<any>}
     */
    finalize(): Promise<any>;
    /**
     * @alias finalize
     * @returns {Promise<any>}
     */
    execute(): Promise<any>;
    /**
     * @alias finalize
     * @returns {Promise<any>}
     */
    run(): Promise<any>;
    private createNewValueRow();
}
