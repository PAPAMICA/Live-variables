export function stringifyIfObj(obj: any): string {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj === 'object') {
        try {
            return JSON.stringify(obj);
        } catch {
            return String(obj);
        }
    }
    return String(obj);
}

export function trancateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
} 