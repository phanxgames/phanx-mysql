import { Dictionary } from "dictionaryjs";
export declare class Util {
    static generateToken(length: number, collection: Dictionary<string, boolean>): string;
    static generateRandomString(length: number): string;
    static getTimestamp(): number;
    static now(): string;
    static formatDateTime(date?: string): string;
    static pad(input: any, width: number, padding: string): string;
    static getTimeDiff(ts: number, unit: string): number;
    static timeStart(): [number, number];
    static timeEnd(start: [number, number]): string;
    static isPlainObject(o: any): boolean;
    private static _isObjectObject;
    static isObject(val: any): boolean;
    static isNumeric(n: any): boolean;
}
