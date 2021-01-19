export function handler<T extends any[]>(fn: (...args: T) => string | void) {
    return function (...args: T) {
        try {
            const res = fn(...args);
            if (res !== undefined) console.log(res);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    };
}

export function asyncHandler<T extends any[]>(fn: (...args: T) => Promise<string | void>) {
    return async function (...args: T) {
        try {
            const res = await fn(...args);
            if (res !== undefined) console.log(res);
        } catch (err) {
            console.error(err);
            process.exit(1);
        }
    };
}
