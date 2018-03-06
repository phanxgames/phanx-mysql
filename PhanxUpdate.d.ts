import { PhanxMysql } from "./PhanxMysql";
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
}
